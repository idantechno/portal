import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { GmailService } from '../integrations/gmail.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { ExpensesService } from '../expenses/expenses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BusinessesService } from '../businesses/businesses.service';
import { AgentsService } from '../agents/agents.service';
import { MailItem, MailItemStatus } from './mail-item.entity';
import { MAIL_AGENT_QUEUE } from './mail-agent.constants';
import { MailDetector } from './detectors/mail-detector';
import { InvoiceDetector } from './detectors/invoice.detector';

/**
 * The "mail agent" (סוכן מייל) — a triage ENGINE that polls each entitled +
 * Gmail-connected business's inbox, runs a set of {@link MailDetector}s over
 * recent messages, and drops matches into an owner-approval queue. Nothing is
 * filed automatically: an item lands `pending` and only becomes an
 * {@link Expense} when the owner approves it (which reuses ExpensesService, so
 * the amount/vendor/date are parsed from the attachment at that point — never
 * per-email during the sweep, to keep cost near zero).
 *
 * Shipped with ONE detector (invoices); adding future detectors is just adding
 * a class to {@link detectors}. Scheduling mirrors {@link TaskRemindersService}:
 * a BullMQ repeatable 'sweep' job (every 30 min) added in onModuleInit and
 * consumed by {@link MailAgentProcessor}.
 */
@Injectable()
export class MailAgentService implements OnModuleInit {
  private readonly log = new Logger(MailAgentService.name);

  /** Registered triage rules. Ship one; add classes to extend the engine. */
  private readonly detectors: MailDetector[] = [new InvoiceDetector()];

  /**
   * Gmail search that pre-filters volume before the detectors run. `newer_than`
   * bounds the window; the keyword clause cuts the fetch to likely invoices.
   */
  private static readonly GMAIL_QUERY =
    'newer_than:3d (invoice OR receipt OR bill OR חשבונית OR קבלה OR תשלום)';

  constructor(
    @InjectRepository(MailItem)
    private readonly items: Repository<MailItem>,
    private readonly gmail: GmailService,
    private readonly integrations: IntegrationsService,
    private readonly expenses: ExpensesService,
    private readonly notifications: NotificationsService,
    private readonly businesses: BusinessesService,
    private readonly agents: AgentsService,
    @InjectQueue(MAIL_AGENT_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Scheduled run is DISABLED (no automatic jobs/notifications). Repeatable
    // jobs live in Redis and survive deploys, so actively remove any that were
    // registered before. Manual triggers still work.
    try {
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    } catch (err) {
      this.log.error(
        `Failed to clear mail-agent sweep schedule: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Poll every entitled + Gmail-connected business, detect invoice candidates,
   * and enqueue new `pending` items. Per-business and per-message try/catch keep
   * one failure from stalling the whole sweep. Returns the number of items
   * created across all businesses.
   */
  async sweep(): Promise<number> {
    let created = 0;
    let businesses: { id: string }[];
    try {
      businesses = await this.businesses.listAll();
    } catch (err) {
      this.log.error(
        `mail-agent sweep listAll failed: ${(err as Error).message}`,
      );
      return 0;
    }
    for (const business of businesses) {
      try {
        if (!(await this.agents.hasAccess(business.id, 'email'))) continue;
        if (!(await this.integrations.isConnected(business.id, 'gmail'))) {
          continue;
        }
        created += await this.sweepBusiness(business.id);
      } catch (err) {
        // Per-business isolation — one tenant's failure never stalls the sweep.
        this.log.warn(
          `mail-agent sweep for business ${business.id} failed: ${(err as Error).message}`,
        );
      }
    }
    if (created > 0) this.log.log(`mail-agent created ${created} new item(s).`);
    return created;
  }

  /** Sweep a single business's inbox. Returns the number of new items created. */
  private async sweepBusiness(businessId: string): Promise<number> {
    const ids = await this.gmail.listMessageIds(
      businessId,
      MailAgentService.GMAIL_QUERY,
    );
    let created = 0;
    for (const gmailMessageId of ids) {
      try {
        // Dedupe: skip a message we've already captured for this business.
        const exists = await this.items.findOne({
          where: { businessId, gmailMessageId },
        });
        if (exists) continue;

        const msg = await this.gmail.getMessage(businessId, gmailMessageId);
        const detector = this.detectors.find((d) => d.detect(msg).matched);
        if (!detector) continue;

        const attachment =
          msg.attachments.find(
            (a) =>
              a.mimeType?.toLowerCase() === 'application/pdf' ||
              /\.pdf$/i.test(a.filename ?? ''),
          ) ?? msg.attachments[0];

        await this.items.save(
          this.items.create({
            businessId,
            gmailMessageId,
            detector: detector.key,
            status: 'pending',
            fromAddress: (msg.from || '').slice(0, 255),
            subject: (msg.subject || '(ללא נושא)').slice(0, 255),
            snippet: msg.snippet,
            receivedAt: new Date(msg.internalDate),
            hasAttachment: Boolean(attachment),
            attachmentId: attachment?.attachmentId ?? null,
            attachmentName: attachment?.filename ?? null,
            attachmentMime: attachment?.mimeType ?? null,
          }),
        );
        created += 1;
      } catch (err) {
        // One bad message must not stall the rest of the business's sweep.
        this.log.warn(
          `mail-agent message ${gmailMessageId} (business ${businessId}) failed: ${(err as Error).message}`,
        );
      }
    }
    if (created > 0) {
      // Bell the owner ONCE per business per sweep — in-app only, no spam.
      try {
        await this.notifications.notify({
          businessId,
          type: 'mail',
          title: 'נמצאו חשבוניות חדשות במייל',
          body: `${created} פריטים ממתינים לאישור בתור.`,
          link: `/app/businesses/${businessId}/agents/email`,
          channels: [],
        });
      } catch (err) {
        this.log.warn(
          `mail-agent bell for business ${businessId} failed: ${(err as Error).message}`,
        );
      }
    }
    return created;
  }

  /** The business's mail items, newest first (optionally filtered by status). */
  list(businessId: string, status?: MailItemStatus): Promise<MailItem[]> {
    return this.items.find({
      where: status ? { businessId, status } : { businessId },
      order: { receivedAt: 'DESC' },
      take: 100,
    });
  }

  /**
   * Approve a pending item → file it as an expense. When the item has an
   * attachment, the PDF is downloaded and handed to ExpensesService.create,
   * which extracts amount/vendor/date. Without an attachment, a titled expense
   * is created for the owner to complete by hand.
   */
  async approve(businessId: string, itemId: string): Promise<MailItem> {
    const item = await this.items.findOne({
      where: { id: itemId, businessId },
    });
    if (!item || item.status !== 'pending') {
      throw new NotFoundException('Mail item not found');
    }
    const title = (item.subject || item.fromAddress || 'חשבונית מהמייל').slice(
      0,
      120,
    );

    if (item.hasAttachment && item.attachmentId) {
      const buffer = await this.gmail.getAttachment(
        businessId,
        item.gmailMessageId,
        item.attachmentId,
      );
      const expense = await this.expenses.create({
        businessId,
        title,
        file: {
          buffer,
          mimeType: item.attachmentMime ?? 'application/pdf',
          fileName: item.attachmentName ?? `${item.gmailMessageId}.pdf`,
          size: buffer.length,
        },
      });
      item.expenseId = expense.id;
    } else {
      // No attachment to extract from — file a titled placeholder expense
      // (amount 0) the owner completes by hand. Passing an amount is required
      // by ExpensesService.create when there's no file.
      const expense = await this.expenses.create({
        businessId,
        title,
        amountCents: 0,
      });
      item.expenseId = expense.id;
    }

    item.status = 'approved';
    return this.items.save(item);
  }

  /** Dismiss a pending item — it leaves the queue without becoming an expense. */
  async dismiss(businessId: string, itemId: string): Promise<MailItem> {
    const item = await this.items.findOne({
      where: { id: itemId, businessId },
    });
    if (!item || item.status !== 'pending') {
      throw new NotFoundException('Mail item not found');
    }
    item.status = 'dismissed';
    return this.items.save(item);
  }
}
