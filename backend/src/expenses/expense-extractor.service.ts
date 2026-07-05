import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpenseKind } from './expense.entity';

export interface ExtractedExpense {
  amountCents: number | null;
  currency: string;
  vendor: string | null;
  date: string | null; // YYYY-MM-DD
  kind: ExpenseKind | null;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const API_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicContentBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

/**
 * Reads an uploaded expense document (image / PDF / text) and extracts the
 * amount, vendor, date and whether it's a fixed monthly bill or a one-off —
 * using Claude's vision/document understanding via the Messages API. Best
 * effort: returns nulls on any failure so the caller can fall back to manual
 * entry.
 */
@Injectable()
export class ExpenseExtractorService {
  private readonly log = new Logger(ExpenseExtractorService.name);

  constructor(private readonly config: ConfigService) {}

  async extract(
    mimeType: string,
    buffer: Buffer,
  ): Promise<ExtractedExpense | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.log.warn('ANTHROPIC_API_KEY not set — skipping expense extraction');
      return null;
    }
    const model = this.config.get<string>('AGENT_MODEL', 'claude-sonnet-4-6');

    const block = this.contentBlock(mimeType, buffer);
    if (!block) return null;

    const system = `You read a business EXPENSE document (invoice, receipt, or bill) and extract structured data. Return ONLY strict minified JSON, no prose, with exactly these keys:
{"amount": number|null, "currency": string, "vendor": string|null, "date": string|null, "kind": "fixed"|"occasional"|null}
- amount: the total amount the business has to pay, as a plain number (no currency symbol, no thousands separators). If several totals appear, take the final total due (incl. VAT). null if you truly cannot find it.
- currency: ISO-ish code, default "ILS" for ₪ / שקל.
- vendor: the supplier / biller name (short), in the document's language.
- date: the document/issue date as "YYYY-MM-DD", else null.
- kind: "fixed" for a recurring monthly bill (electricity/חשמל, water/מים, arnona/ארנונה, rent/שכירות, phone, internet, subscriptions); "occasional" for a one-off purchase; null if unsure.`;

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
          max_tokens: 400,
          system,
          messages: [
            {
              role: 'user',
              content: [
                block,
                {
                  type: 'text',
                  text: 'Extract the expense details as the JSON described.',
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(40000),
      });
      if (!res.ok) {
        this.log.warn(`extraction API ${res.status}`);
        return null;
      }
      const json = (await res.json()) as AnthropicResponse;
      const text = (json.content ?? [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('');
      return this.parse(text);
    } catch (err) {
      this.log.warn(`extraction failed: ${(err as Error).message}`);
      return null;
    }
  }

  private contentBlock(
    mimeType: string,
    buffer: Buffer,
  ): Record<string, unknown> | null {
    if (IMAGE_TYPES.includes(mimeType)) {
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: mimeType,
          data: buffer.toString('base64'),
        },
      };
    }
    if (mimeType === 'application/pdf') {
      return {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: buffer.toString('base64'),
        },
      };
    }
    // Treat everything else as text.
    const text = buffer.toString('utf8').slice(0, 20000);
    if (!text.trim()) return null;
    return { type: 'text', text: `Expense document text:\n${text}` };
  }

  private parse(text: string): ExtractedExpense | null {
    const match = /\{[\s\S]*\}/.exec(text);
    if (!match) return null;
    try {
      const obj = JSON.parse(match[0]) as {
        amount?: number | string | null;
        currency?: string;
        vendor?: string | null;
        date?: string | null;
        kind?: string | null;
      };
      const amountNum =
        typeof obj.amount === 'string' ? parseFloat(obj.amount) : obj.amount;
      const amountCents =
        typeof amountNum === 'number' && isFinite(amountNum)
          ? Math.round(amountNum * 100)
          : null;
      const kind =
        obj.kind === 'fixed' || obj.kind === 'occasional' ? obj.kind : null;
      const date =
        typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date)
          ? obj.date
          : null;
      return {
        amountCents,
        currency: obj.currency || 'ILS',
        vendor: obj.vendor?.trim() || null,
        date,
        kind,
      };
    } catch {
      return null;
    }
  }
}
