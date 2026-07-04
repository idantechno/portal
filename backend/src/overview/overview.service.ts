import { Injectable, Logger } from '@nestjs/common';
import { AgentRunner } from '../agents/agent-runner.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { renderOnboardingProfile } from '../agents/onboarding-context';
import { Business } from '../businesses/business.entity';
import { WEATHER_CODES } from './weather-codes';

export interface NewsItem {
  title: string;
  link: string;
  source: string;
}
export interface WeatherNow {
  city: string;
  tempC: number;
  hi: number;
  lo: number;
  description: string;
  emoji: string;
}
export interface OverviewExtras {
  /** AI-authored daily tip tailored to the business (null if unavailable). */
  tip: string | null;
  /** One recent news item from the business's field (null if unavailable). */
  news: NewsItem | null;
  /** Today's weather for the business's city (null if unavailable). */
  weather: WeatherNow | null;
}

// Tel Aviv — the default location when the owner hasn't set a city.
const DEFAULT_LAT = 32.0853;
const DEFAULT_LON = 34.7818;
const DEFAULT_CITY = 'תל אביב';
const FETCH_TIMEOUT_MS = 8000;

interface GeoResp {
  results?: { latitude: number; longitude: number; name: string }[];
}
interface ForecastResp {
  current?: { temperature_2m?: number; weather_code?: number };
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[] };
}

/**
 * Assembles the "live" widgets of the home overview that need server-side work:
 * an AI daily tip, a field-relevant news item (Google News RSS, no API key),
 * and today's weather (Open-Meteo, no API key). Everything is best-effort — any
 * part that fails returns null and the UI degrades gracefully. Results are
 * cached once per Israel calendar day per business to bound cost and latency.
 */
@Injectable()
export class OverviewService {
  private readonly log = new Logger(OverviewService.name);
  private readonly cache = new Map<
    string,
    { day: string; data: OverviewExtras }
  >();

  constructor(
    private readonly runner: AgentRunner,
    private readonly filesystem: FilesystemService,
  ) {}

  private todayKey(): string {
    return new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Jerusalem',
    });
  }

  async get(business: Business): Promise<OverviewExtras> {
    const day = this.todayKey();
    const cached = this.cache.get(business.id);
    if (cached && cached.day === day) return cached.data;

    const [tip, news, weather] = await Promise.all([
      this.buildTip(business),
      this.fetchNews(business),
      this.fetchWeather(business),
    ]);
    const data: OverviewExtras = { tip, news, weather };
    this.cache.set(business.id, { day, data });
    return data;
  }

  private async buildTip(business: Business): Promise<string | null> {
    try {
      await this.filesystem.ensureBusinessRoot(business.id);
      const cwd = this.filesystem.businessRoot(business.id);
      const profile = renderOnboardingProfile(business);
      const today = new Date().toLocaleDateString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      const system = [
        `You write ONE short daily tip in Hebrew (masculine grammatical forms) for a business owner. Tailor it to their field and to what is timely now. 1–2 sentences, concrete and motivating, oriented toward growing the business and using this system's tools. Output ONLY the tip text — no preamble, no quotes, no role labels.`,
        profile ?? `The business is called ${business.name}.`,
      ].join('\n\n');
      const { finalText } = await this.runner.run({
        systemPrompt: system,
        prompt: `Today is ${today}. Write today's tip for ${business.name}.`,
        cwd,
        allowedBuiltinTools: [],
        maxTurns: 1,
        timeoutMs: 30000,
        runLabel: `overview-tip business=${business.id}`,
      });
      return finalText.trim() || null;
    } catch (err) {
      this.log.warn(`tip failed for ${business.id}: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchNews(business: Business): Promise<NewsItem | null> {
    try {
      const q = business.onboarding?.industry?.trim() || business.name;
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
        q,
      )}&hl=he&gl=IL&ceid=IL:he`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const xml = await res.text();
      const item = /<item>([\s\S]*?)<\/item>/.exec(xml)?.[1];
      if (!item) return null;
      const rawTitle = /<title>([\s\S]*?)<\/title>/.exec(item)?.[1] ?? '';
      const link = /<link>([\s\S]*?)<\/link>/.exec(item)?.[1] ?? '';
      const decoded = this.decodeXml(rawTitle);
      // Google News titles read "Headline - Source"; split the trailing source.
      const idx = decoded.lastIndexOf(' - ');
      const title = idx > 0 ? decoded.slice(0, idx) : decoded;
      const source = idx > 0 ? decoded.slice(idx + 3) : '';
      if (!title) return null;
      return { title, link: link.trim(), source };
    } catch (err) {
      this.log.warn(
        `news failed for ${business.id}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async fetchWeather(business: Business): Promise<WeatherNow | null> {
    try {
      let lat = DEFAULT_LAT;
      let lon = DEFAULT_LON;
      let name = DEFAULT_CITY;
      const city = business.onboarding?.city?.trim();
      if (city) {
        const geo = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            city,
          )}&count=1&language=he&format=json`,
          { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
        );
        if (geo.ok) {
          const gj = (await geo.json()) as GeoResp;
          const r = gj.results?.[0];
          if (r) {
            lat = r.latitude;
            lon = r.longitude;
            name = r.name;
          }
        }
      }
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
      );
      if (!res.ok) return null;
      const j = (await res.json()) as ForecastResp;
      const code = j.current?.weather_code ?? 0;
      const desc = WEATHER_CODES[code] ?? { he: '—', emoji: '🌡️' };
      return {
        city: name,
        tempC: Math.round(j.current?.temperature_2m ?? 0),
        hi: Math.round(j.daily?.temperature_2m_max?.[0] ?? 0),
        lo: Math.round(j.daily?.temperature_2m_min?.[0] ?? 0),
        description: desc.he,
        emoji: desc.emoji,
      };
    } catch (err) {
      this.log.warn(
        `weather failed for ${business.id}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private decodeXml(s: string): string {
    return s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();
  }
}
