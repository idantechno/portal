import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ClaudeJsonService } from '../briefs/claude-json.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessesService } from '../businesses/businesses.service';
import { AgentsService } from '../agents/agents.service';
import {
  AiUpdate,
  AiUpdateItem,
  AiUpdateScope,
  AiUpdateSource,
} from './ai-update.entity';
import { AI_UPDATES_QUEUE } from './ai-updates.constants';

/** Shape the model is asked to return for every digest. */
interface DigestPayload {
  title?: string;
  summary?: string;
  items?: AiUpdateItem[];
  sources?: AiUpdateSource[];
}

/**
 * The "AI updates agent" (סוכן עדכוני AI). Generates two globally-shared digests
 * on a schedule, each grounded in live web search (no invention — a null model
 * reply is logged and skipped):
 * - a DAILY 'business' digest of AI news useful to small/medium business owners,
 *   shown to every tenant with the agent enabled (and pushed to their bell);
 * - a WEEKLY 'internal' digest of Anthropic/Claude updates for the operator.
 *
 * Scheduling mirrors {@link TaskRemindersService}: two BullMQ repeatable jobs
 * added in onModuleInit, consumed by {@link AiUpdatesProcessor}.
 */
@Injectable()
export class AiUpdatesService implements OnModuleInit {
  private readonly log = new Logger(AiUpdatesService.name);

  constructor(
    private readonly claude: ClaudeJsonService,
    @InjectRepository(AiUpdate)
    private readonly updates: Repository<AiUpdate>,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessesService,
    private readonly agents: AgentsService,
    @InjectQueue(AI_UPDATES_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Scheduled digests are DISABLED (they burned too many API credits on web
    // search). Repeatable jobs live in Redis and survive deploys, so actively
    // remove any previously-registered ones on boot. Manual generation via the
    // admin endpoint still works.
    try {
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    } catch (err) {
      this.log.error(
        `Failed to clear ai-updates schedules: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Daily AI-news digest for business owners. Searches for the most significant,
   * genuinely useful AI developments of the last ~24–48h and saves them as a
   * 'business'-scoped row, then fans a bell notification out to every entitled
   * business. Returns the saved row, or null when the model gave nothing.
   */
  async generateDailyBusinessUpdate(): Promise<AiUpdate | null> {
    const system =
      'אתה עורך חדשות AI לבעלי עסקים קטנים ובינוניים. אתה מסכם רק חדשות אמיתיות ' +
      'ועדכניות שמצאת בחיפוש באינטרנט, בלי להמציא. כתוב בעברית ברורה ותכליתית, ' +
      'בגובה העיניים, בלי באזז מיותר. החזר JSON בלבד.';
    const user =
      'חפש באינטרנט את חדשות ה-AI, הכלים, המודלים והפיצ׳רים החדשים המשמעותיים ' +
      'ביותר מ-24–48 השעות האחרונות שבאמת שימושיים לבעל עסק קטן/בינוני: אוטומציה, ' +
      'שיווק, מכירות, פרודוקטיביות, שירות לקוחות וכלי AI חדשים. בחר 3–5 הכי ' +
      'רלוונטיים. החזר אובייקט JSON יחיד במבנה: ' +
      '{ "title": string, "summary": string, "items": [{ "headline": string, ' +
      '"detail": string }], "sources": [{ "title": string, "url": string }] }. ' +
      'כל הטקסט בעברית פרט לכותרות ולכתובות המקורות. אל תמציא — אם לא מצאת די ' +
      'חדשות, החזר פחות פריטים.';

    // The AI-updates agent is operator-only (see agent-catalog `operatorOnly`),
    // so we no longer ring a daily bell across every client business — that
    // would deep-link clients to a page they can't open. The operator reads the
    // digest by opening the agent page. `fanOutBusinessBell` is kept for a
    // possible future operator-scoped notification.
    return this.generate('business', system, user);
  }

  /**
   * Weekly Anthropic/Claude digest for the operator. Searches specifically for
   * new Claude models, API features, Claude Code and tooling from the last week
   * that help idant build/run his business and products. Saved as 'internal'.
   */
  async generateWeeklyInternalUpdate(): Promise<AiUpdate | null> {
    const system =
      'אתה עוזר אישי טכנולוגי לבונה מוצרי SaaS מבוססי Claude. אתה מסכם רק ' +
      'עדכונים אמיתיים ועדכניים של Anthropic/Claude שמצאת בחיפוש, בלי להמציא. ' +
      'כתוב בעברית ברורה ותכליתית. החזר JSON בלבד.';
    const user =
      'חפש באינטרנט את העדכונים של Anthropic ו-Claude מהשבוע האחרון: מודלים ' +
      'חדשים של Claude, פיצ׳רים חדשים ב-API, Claude Code, כלים ויכולות חדשות. ' +
      'התמקד במה שעוזר לבנות ולתפעל עסק ומוצרים מבוססי Claude. בחר 3–5 הכי ' +
      'משמעותיים. החזר אובייקט JSON יחיד במבנה: ' +
      '{ "title": string, "summary": string, "items": [{ "headline": string, ' +
      '"detail": string }], "sources": [{ "title": string, "url": string }] }. ' +
      'כל הטקסט בעברית פרט לכותרות ולכתובות המקורות. אל תמציא.';

    return this.generate('internal', system, user);
  }

  /** Latest digests of a scope, newest first. */
  list(scope: AiUpdateScope): Promise<AiUpdate[]> {
    return this.updates.find({
      where: { scope },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /** The most recent digest of a scope, or null if none generated yet. */
  latest(scope: AiUpdateScope): Promise<AiUpdate | null> {
    return this.updates.findOne({
      where: { scope },
      order: { createdAt: 'DESC' },
    });
  }

  /** Shared generation core: web-search JSON call → persisted row (or null). */
  private async generate(
    scope: AiUpdateScope,
    system: string,
    user: string,
  ): Promise<AiUpdate | null> {
    const payload = await this.claude.jsonWithWebSearch<DigestPayload>({
      system,
      user,
      maxTokens: 4000,
      // Cap the server-side web searches per run. Claude meters the web_search
      // server tool at the account level; keeping this modest stretches that
      // allotment across many daily/weekly runs and avoids "Server tool use
      // limit exceeded". 3–5 items rarely need more than this.
      maxSearches: 5,
      timeoutMs: 300_000,
    });
    if (!payload || !payload.title || !payload.summary) {
      // No invention: a null/empty reply is logged and skipped, not faked.
      this.log.warn(
        `AI-updates ${scope} generation returned nothing — skipping.`,
      );
      return null;
    }
    const row = await this.updates.save(
      this.updates.create({
        scope,
        title: payload.title.slice(0, 255),
        summary: payload.summary,
        items: Array.isArray(payload.items) ? payload.items : [],
        sources: Array.isArray(payload.sources) ? payload.sources : [],
      }),
    );
    this.log.log(`Generated ${scope} AI-updates digest "${row.title}".`);
    return row;
  }

  /**
   * Ring the in-app bell for every business that has the ai-updates agent — but
   * ONLY the bell (channels: []), never email/push, so a daily digest can't turn
   * into daily spam. Best-effort: a notify failure for one business never breaks
   * generation or the rest of the fan-out.
   */
  private async fanOutBusinessBell(update: AiUpdate): Promise<void> {
    try {
      const businesses = await this.businesses.listAll();
      for (const business of businesses) {
        try {
          const entitled = await this.agents.hasAccess(
            business.id,
            'ai-updates',
          );
          if (!entitled) continue;
          await this.notifications.notify({
            businessId: business.id,
            type: 'ai-update',
            title: 'עדכון AI חדש',
            body: update.title,
            link: `/app/businesses/${business.id}/agents/ai-updates`,
            // In-app bell only — no push/email to avoid daily spam.
            channels: [],
          });
        } catch (err) {
          this.log.warn(
            `AI-update bell for business ${business.id} failed: ` +
              `${(err as Error).message}`,
          );
        }
      }
    } catch (err) {
      this.log.warn(`AI-update bell fan-out failed: ${(err as Error).message}`);
    }
  }
}
