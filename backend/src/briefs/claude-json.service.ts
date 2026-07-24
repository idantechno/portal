import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const API_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

export interface ClaudeJsonRequest {
  system: string;
  user: string;
  maxTokens?: number;
  /** Overrides BRIEF_MODEL for this call. */
  model?: string;
  timeoutMs?: number;
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
