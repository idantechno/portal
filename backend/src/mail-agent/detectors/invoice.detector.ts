import { GmailMessage } from '../../integrations/gmail.service';
import { MailDetector } from './mail-detector';

/**
 * Subject/snippet keywords that mark an email as a likely invoice/receipt.
 * Hebrew + English, matched case-insensitively. Deliberately heuristic — no
 * per-email model call; the real amount/vendor/date parsing happens later, on
 * approval, via ExpensesService → ExpenseExtractorService.
 */
export const INVOICE_KEYWORDS = [
  'חשבונית מס',
  'חשבונית',
  'קבלה',
  'תשלום',
  'invoice',
  'receipt',
  'bill',
  'payment',
] as const;

/**
 * Flags invoice/receipt candidates. Matches when the subject or snippet
 * contains an invoice keyword OR the email carries a PDF attachment.
 */
export class InvoiceDetector implements MailDetector {
  readonly key = 'invoice';

  detect(msg: GmailMessage): { matched: boolean } {
    const haystack = `${msg.subject ?? ''} ${msg.snippet ?? ''}`.toLowerCase();
    const keywordHit = INVOICE_KEYWORDS.some((kw) =>
      haystack.includes(kw.toLowerCase()),
    );
    const pdfHit = msg.attachments.some(
      (a) =>
        a.mimeType?.toLowerCase() === 'application/pdf' ||
        /\.pdf$/i.test(a.filename ?? ''),
    );
    return { matched: keywordHit || pdfHit };
  }
}
