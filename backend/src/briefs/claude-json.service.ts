import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const API_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
}

export interface ClaudeJsonRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Overrides BRIEF_MODEL for this call. */
  model?: string;
  timeoutMs?: number;
}

export interface ClaudeWebSearchRequest extends ClaudeJsonRequest {
  /** Cap on how many server-side searches the model may run (default 5). */
  maxSearches?: number;
}

/**
 * One-shot structured calls to the Messages API.
 *
 * The brief pipeline doesn't need an agent loop — it needs two deterministic
 * "text in, JSON out" steps (extract from a website, draft the positioning).
 * Keeping them here instead of in `AgentRunner` means no tools, no session, no
 * filesystem, and a hard timeout.
 *
 * Every failure path returns `null`: the pipeline then falls back to
 * "⟨לא ידוע⟩" for that layer rather than to invented content.
 */
@Injectable()
export class ClaudeJsonService {
  private readonly log = new Logger(ClaudeJsonService.name);

  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return this.config.get<string>('BRIEF_MODEL', 'claude-opus-4-8');
  }

  get configured(): boolean {
    return Boolean(this.config.get<string>('ANTHROPIC_API_KEY'));
  }

  async json<T = unknown>(req: ClaudeJsonRequest): Promise<T | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.log.warn('ANTHROPIC_API_KEY not set — skipping model call');
      return null;
    }
    const model = req.model ?? this.model;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens ?? 4000,
          system: req.system,
          // No assistant prefill here — the newer models reject it, so the
          // reply is unwrapped by `parse` instead (fences + surrounding prose).
          messages: [{ role: 'user', content: req.user }],
        }),
        signal: AbortSignal.timeout(req.timeoutMs ?? 120_000),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.log.warn(`model call ${res.status}: ${body.slice(0, 300)}`);
        return null;
      }
      const json = (await res.json()) as AnthropicResponse;
      const text = (json.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      return this.parse<T>(text);
    } catch (err) {
      this.log.warn(`model call failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Like `json`, but with Anthropic's server-side web search enabled so the
   * model can gather fresh facts before answering — used by the AI-updates
   * agent to base each digest on real, current sources. The model runs searches
   * on Anthropic's side (no browser here), then returns a JSON object which we
   * parse the same way. Handles `pause_turn` (the server-tool loop hitting its
   * iteration cap) by resuming up to a few times. Returns null on any failure.
   */
  async jsonWithWebSearch<T = unknown>(
    req: ClaudeWebSearchRequest,
  ): Promise<T | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.log.warn('ANTHROPIC_API_KEY not set — skipping web-search call');
      return null;
    }
    const model = req.model ?? this.model;
    // Conversation grows as the server-tool loop resumes on pause_turn.
    const messages: Array<{ role: string; content: unknown }> = [
      { role: 'user', content: req.user },
    ];

    try {
      for (let turn = 0; turn < 4; turn++) {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: req.maxTokens ?? 4000,
            system: req.system,
            messages,
            tools: [
              {
                type: 'web_search_20260209',
                name: 'web_search',
                max_uses: req.maxSearches ?? 5,
              },
            ],
          }),
          signal: AbortSignal.timeout(req.timeoutMs ?? 300_000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          // Distinguish the server-side web-search cap from ordinary failures so
          // the operator can act on it. "Server tool use limit exceeded" (and
          // 429s referencing tool use) means Claude's account-level web-search
          // allotment is exhausted — nothing we can retry around; the operator
          // must raise the limit/quota on the Anthropic account.
          const limitHit =
            res.status === 429 || /server tool use|tool.*limit/i.test(body);
          if (limitHit) {
            this.log.error(
              `web-search server-tool limit exceeded (${res.status}). ` +
                `Claude's account-level web_search allotment is likely ` +
                `exhausted — raise the limit/quota on the Anthropic account. ` +
                `${body.slice(0, 200)}`,
            );
          } else {
            this.log.warn(
              `web-search call ${res.status}: ${body.slice(0, 300)}`,
            );
          }
          return null;
        }
        const json = (await res.json()) as AnthropicResponse & {
          content?: unknown[];
        };
        const blocks = (json.content ?? []) as AnthropicContentBlock[];
        // On pause_turn the model isn't done — echo its turn back and continue
        // so the server resumes the search loop where it left off.
        if (json.stop_reason === 'pause_turn') {
          messages.push({ role: 'assistant', content: json.content });
          continue;
        }
        const text = blocks
          .filter((b) => b.type === 'text')
          .map((b) => b.text ?? '')
          .join('');
        return this.parse<T>(text);
      }
      this.log.warn('web-search call did not settle within the turn budget');
      return null;
    } catch (err) {
      this.log.warn(`web-search call failed: ${(err as Error).message}`);
      return null;
    }
  }

  private parse<T>(text: string): T | null {
    const cleaned = text
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) {
      this.log.warn('model reply contained no JSON object');
      return null;
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch (err) {
      this.log.warn(
        `model reply was not valid JSON: ${(err as Error).message}`,
      );
      return null;
    }
  }
}
