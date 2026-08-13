import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ExpensesService } from '../expenses/expenses.service';
import {
  GmailService,
  GmailOutAttachment,
} from '../integrations/gmail.service';
import { WhatsappConnectionsService } from '../whatsapp/whatsapp-connections.service';
import { BusinessesService } from '../businesses/businesses.service';
import { Expense } from '../expenses/expense.entity';

/** Normalize an owner-typed phone to WhatsApp digits (050… → 972…). */
function toWaPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return `972${digits.slice(1)}`;
  return digits;
}

/** Outcome of one send, surfaced to the UI / agent so nothing is silent. */
export interface AccountantSendResult {
  periodLabel: string;
  expenseCount: number;
  filesAttached: number;
  /** Expenses in range that have no stored file — listed in the summary anyway. */
  missingFiles: number;
  totalIls: number;
  emailedTo: string | null;
  emailError: string | null;
  whatsappedTo: string | null;
  whatsappError: string | null;
}

@Injectable()
export class AccountantService {
  private readonly log = new Logger(AccountantService.name);

  constructor(
    private readonly expenses: ExpensesService,
    private readonly gmail: GmailService,
    private readonly whatsapp: WhatsappConnectionsService,
    private readonly businesses: BusinessesService,
  ) {}

  /** Whether a recipient is configured — drives the "send" button's UI. */
  async status(
    businessId: string,
  ): Promise<{ hasEmail: boolean; hasPhone: boolean }> {
    const b = await this.businesses.findById(businessId);
    return {
      hasEmail: Boolean(b?.accountantEmail),
      hasPhone: Boolean(b?.accountantPhone),
    };
  }

  /** [from, to) covering the given month (defaults to the current month). */
  private monthRange(
    year?: number,
    month?: number,
  ): { from: Date; to: Date; label: string } {
    const now = new Date();
    const y = year ?? now.getFullYear();
    // month is 1-12 from the API; JS Date months are 0-11.
    const m = (month ?? now.getMonth() + 1) - 1;
    const from = new Date(y, m, 1, 0, 0, 0, 0);
    const to = new Date(y, m + 1, 1, 0, 0, 0, 0);
    const label = from.toLocaleDateString('he-IL', {
      month: 'long',
      year: 'numeric',
    });
    return { from, to, label };
  }

  /** The date used to bucket an expense into a period. */
  private expenseInstant(e: Expense): Date {
    if (e.expenseDate) return new Date(`${e.expenseDate}T00:00:00`);
    return e.createdAt;
  }

  /** BOM + CSV so Hebrew opens correctly in Excel; every expense is a row. */
  private buildCsv(rows: Expense[]): string {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'תאריך',
      'תיאור',
      'סוג',
      'סכום (₪)',
      'מטבע',
      'סטטוס',
      'קובץ',
      'הערה',
    ];
    const lines = [header.join(',')];
    for (const e of rows) {
      lines.push(
        [
          esc(e.expenseDate ?? e.createdAt.toISOString().slice(0, 10)),
          esc(e.title),
          esc(e.kind === 'fixed' ? 'קבועה' : 'חד-פעמית'),
          esc(e.amountCents != null ? (e.amountCents / 100).toFixed(2) : ''),
          esc(e.currency),
          esc(e.status),
          esc(e.fileName ?? ''),
          esc(e.note ?? ''),
        ].join(','),
      );
    }
    return '﻿' + lines.join('\r\n');
  }

  /**
   * Gather every expense in the period, attach each stored receipt/invoice file
   * plus a complete CSV summary, and send to the business's LOCKED accountant
   * recipient — email (full package) and WhatsApp (a short summary). The
   * recipient is never a parameter: it always comes from the business record, so
   * this can be triggered by a button, the agent, or a cron without ever leaking
   * documents to another address.
   */
  async sendToAccountant(
    businessId: string,
    opts: { year?: number; month?: number } = {},
  ): Promise<AccountantSendResult> {
    const business = await this.businesses.findById(businessId);
    if (!business) throw new BadRequestException('Business not found');
    if (!business.accountantEmail && !business.accountantPhone) {
      throw new BadRequestException('ACCOUNTANT_RECIPIENT_NOT_SET');
    }

    const { from, to, label } = this.monthRange(opts.year, opts.month);
    const all = await this.expenses.list(businessId);
    const inRange = all
      .filter((e) => {
        const t = this.expenseInstant(e);
        return t >= from && t < to;
      })
      .sort(
        (a, b) =>
          this.expenseInstant(a).getTime() - this.expenseInstant(b).getTime(),
      );

    // Collect the actual receipt/invoice files. A single unreadable file must
    // not abort the whole package — it's counted as "missing" and still listed
    // in the CSV, so the accountant sees it exists.
    const attachments: GmailOutAttachment[] = [];
    let missingFiles = 0;
    for (const e of inRange) {
      if (!e.relativePath) {
        missingFiles += 1;
        continue;
      }
      try {
        const { buffer } = await this.expenses.download(businessId, e.id);
        attachments.push({
          filename: e.fileName ?? `expense-${e.id}.bin`,
          mimeType: e.mimeType ?? 'application/octet-stream',
          content: buffer,
        });
      } catch (err) {
        missingFiles += 1;
        this.log.warn(
          `[accountant] file read failed for expense ${e.id}: ${(err as Error).message}`,
        );
      }
    }

    const totalCents = inRange.reduce((s, e) => s + (e.amountCents ?? 0), 0);
    const totalIls = Math.round(totalCents / 100);

    // The CSV is the source of truth — every expense in range is a row, even
    // ones whose file is missing. Prepend it so it leads the attachment list.
    const csv = this.buildCsv(inRange);
    const summaryAttachment: GmailOutAttachment = {
      filename: `סיכום-הוצאות-${label}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: Buffer.from(csv, 'utf8'),
    };

    const result: AccountantSendResult = {
      periodLabel: label,
      expenseCount: inRange.length,
      filesAttached: attachments.length,
      missingFiles,
      totalIls,
      emailedTo: null,
      emailError: null,
      whatsappedTo: null,
      whatsappError: null,
    };

    const bodyLines = [
      `שלום,`,
      ``,
      `מצורפים המסמכים הכספיים של ${business.name} לתקופה: ${label}.`,
      ``,
      `סה"כ ${inRange.length} הוצאות, ${attachments.length} קבצים מצורפים, סכום כולל כ-${totalIls.toLocaleString('he-IL')} ₪.`,
      missingFiles > 0
        ? `שים לב: ל-${missingFiles} רשומות אין קובץ מצורף — הן מופיעות בקובץ הסיכום.`
        : ``,
      ``,
      `קובץ הסיכום (CSV) כולל את כל ההוצאות לתקופה.`,
      ``,
      `בברכה,`,
      business.name,
    ].filter((l) => l !== undefined);

    // Email — the full package (summary + every file).
    if (business.accountantEmail) {
      try {
        await this.gmail.sendEmail(businessId, {
          to: business.accountantEmail,
          subject: `מסמכים לרו"ח — ${business.name} — ${label}`,
          body: bodyLines.join('\n'),
          attachments: [summaryAttachment, ...attachments],
        });
        result.emailedTo = business.accountantEmail;
      } catch (err) {
        result.emailError = (err as Error).message;
        this.log.warn(
          `[accountant] email send failed for ${businessId}: ${result.emailError}`,
        );
      }
    }

    // WhatsApp — a short summary (files ride the email). Best-effort: a
    // proactive message may be blocked outside the 24h window.
    const waTo = toWaPhone(business.accountantPhone);
    if (waTo) {
      try {
        await this.whatsapp.sendText(
          businessId,
          waTo,
          `שלום, נשלחו המסמכים הכספיים של ${business.name} לתקופה ${label}: ${inRange.length} הוצאות, סכום כ-${totalIls.toLocaleString('he-IL')} ₪. הקבצים המלאים נשלחו למייל.`,
        );
        result.whatsappedTo = waTo;
      } catch (err) {
        result.whatsappError = (err as Error).message;
        this.log.warn(
          `[accountant] whatsapp send failed for ${businessId}: ${result.whatsappError}`,
        );
      }
    }

    return result;
  }
}
