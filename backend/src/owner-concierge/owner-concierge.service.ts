import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnerCommand } from './owner-command.entity';
import { AgentRunner } from '../agents/agent-runner.service';
import { FilesystemService } from '../context-files/filesystem.service';
import { BusinessesService } from '../businesses/businesses.service';
import { TasksService } from '../tasks/tasks.service';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { ExpensesService } from '../expenses/expenses.service';
import { FilingService } from '../filing/filing.service';
import { buildOwnerMcpServer } from './owner-tools';

interface OwnerMessage {
  businessId: string;
  fromPhone: string;
  wamid: string;
  body: string;
}

interface OwnerMedia {
  businessId: string;
  fromPhone: string;
  wamid: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  /** WhatsApp caption sent with the file (empty string if none). */
  caption: string;
}

/**
 * The business owner's personal concierge over WhatsApp. When a message arrives
 * from the owner's OWN number (detected in the webhook), it lands here instead of
 * the customer agent: a Claude agent with owner-action tools (tasks, reminders,
 * customers, leads) does what the owner asked and replies with a short Hebrew
 * confirmation. Never touches the customer Inbox.
 *
 * `handle()` returns the reply text; the caller (webhook) sends it back over
 * WhatsApp — keeping this service free of a dependency on the WhatsApp module
 * (which imports us), so there's no DI cycle.
 */
@Injectable()
export class OwnerConciergeService {
  private readonly log = new Logger(OwnerConciergeService.name);

  constructor(
    @InjectRepository(OwnerCommand)
    private readonly commands: Repository<OwnerCommand>,
    private readonly runner: AgentRunner,
    private readonly filesystem: FilesystemService,
    private readonly businesses: BusinessesService,
    private readonly tasks: TasksService,
    private readonly customers: CustomersService,
    private readonly leads: LeadsService,
    private readonly expenses: ExpensesService,
    private readonly filing: FilingService,
  ) {}

  /**
   * Run the owner's command and return the reply to send back. Returns null when
   * this wamid was already handled (a re-delivered webhook) — the caller should
   * send nothing. Never throws: a failure still returns a friendly reply.
   */
  async handle(input: OwnerMessage): Promise<{ reply: string } | null> {
    // Idempotency + audit: claim the wamid first. A unique-violation means a
    // retried webhook for a command already in flight/done — skip it entirely.
    const claimed = await this.claim(input);
    if (!claimed) {
      this.log.debug(
        `Owner command ${input.wamid} already handled — skipping.`,
      );
      return null;
    }

    let reply: string;
    try {
      reply = await this.runAgent(input.businessId, input.body);
    } catch (err) {
      this.log.error(
        `Owner concierge run failed for business ${input.businessId}: ${(err as Error).message}`,
      );
      reply = 'סליחה, הייתה תקלה זמנית. אפשר לנסות שוב עוד רגע.';
    }

    await this.commands
      .update({ id: claimed.id }, { reply })
      .catch(() => undefined);
    return { reply };
  }

  /**
   * Handle a document/photo the owner sent. A receipt/invoice (an amount is
   * extractable) becomes an expense; anything else is filed under מסמכים. A
   * caption like "תייק" / "הוצאה" overrides the auto-decision. Idempotent by
   * wamid; never throws. Returns the reply, or null if already handled.
   */
  async handleMedia(input: OwnerMedia): Promise<{ reply: string } | null> {
    const claimed = await this.claim({
      businessId: input.businessId,
      fromPhone: input.fromPhone,
      wamid: input.wamid,
      body: `[קובץ] ${input.fileName}${input.caption ? ` — ${input.caption}` : ''}`,
    });
    if (!claimed) return null;

    let reply: string;
    try {
      reply = await this.routeMedia(input);
    } catch (err) {
      this.log.error(
        `Owner media handling failed for business ${input.businessId}: ${(err as Error).message}`,
      );
      reply = 'קיבלתי את הקובץ אבל לא הצלחתי לעבד אותו. אפשר לנסות שוב?';
    }
    await this.commands
      .update({ id: claimed.id }, { reply })
      .catch(() => undefined);
    return { reply };
  }

  /** Decide receipt→expense vs. file→documents and act. Returns the reply. */
  private async routeMedia(input: OwnerMedia): Promise<string> {
    const caption = input.caption.trim();
    const forceFile = /תייק|לתיוק|מסמך/.test(caption);
    const forceExpense = /הוצאה|חשבונית|קבלה|תרשום/.test(caption);
    const file = {
      buffer: input.buffer,
      mimeType: input.mimeType,
      fileName: input.fileName,
      size: input.buffer.length,
    };
    const extractable =
      input.mimeType.startsWith('image/') ||
      input.mimeType === 'application/pdf';

    if (!forceFile && extractable) {
      // Read it as a receipt/invoice — one vision pass. When the owner insists
      // it's an expense we keep the row even if no amount was read (a draft);
      // otherwise we only create an expense when an amount is actually found.
      const expense = forceExpense
        ? await this.expenses.create({ businessId: input.businessId, file })
        : await this.expenses.tryCreateFromFile({
            businessId: input.businessId,
            file,
          });
      if (expense?.amountCents != null) {
        const amount = `₪${(expense.amountCents / 100).toLocaleString('he-IL')}`;
        return `רשמתי הוצאה: ${expense.title} — ${amount}. הקובץ נשמר.`;
      }
      if (forceExpense && expense) {
        return `רשמתי טיוטת הוצאה מהקובץ "${input.fileName}" — לא זוהה סכום, אפשר להשלים במסך "כסף".`;
      }
      // Not a receipt → fall through to filing.
    }

    await this.filing.upload({
      businessId: input.businessId,
      filename: input.fileName,
      mimeType: input.mimeType,
      size: file.size,
      buffer: input.buffer,
    });
    return `תייקתי את המסמך "${input.fileName}" תחת מסמכים.`;
  }

  /** Insert the command row; null if the wamid is already recorded. */
  private async claim(input: OwnerMessage): Promise<OwnerCommand | null> {
    try {
      return await this.commands.save(
        this.commands.create({
          businessId: input.businessId,
          fromPhone: input.fromPhone,
          wamid: input.wamid,
          body: input.body,
          reply: null,
        }),
      );
    } catch {
      // Unique violation on wamid (duplicate delivery) — or any insert failure.
      return null;
    }
  }

  private async runAgent(businessId: string, body: string): Promise<string> {
    const business = await this.businesses.findById(businessId);
    const businessName = business?.name ?? 'העסק';
    const { server, allowedToolNames } = buildOwnerMcpServer({
      businessId,
      tasks: this.tasks,
      customers: this.customers,
      leads: this.leads,
    });

    const result = await this.runner.run({
      systemPrompt: this.systemPrompt(businessName),
      prompt: body,
      cwd: this.filesystem.businessRoot(businessId),
      mcpServers: { owner: server },
      allowedMcpTools: allowedToolNames,
      allowedBuiltinTools: [], // owner concierge acts via tools, not the filesystem
      runLabel: `owner:${businessId.slice(0, 8)}`,
    });
    return result.finalText.trim() || 'בוצע ✓';
  }

  private systemPrompt(businessName: string): string {
    const now = new Date().toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    return [
      `אתה העוזר האישי של בעל העסק "${businessName}", דרך וואטסאפ.`,
      'המשתמש שכותב לך הוא **בעל העסק עצמו** — לא לקוח. הוא מנהל את העסק דרכך.',
      'תפקידך: לבצע את מה שהוא מבקש באמצעות הכלים, ולהשיב אישור קצר וברור בעברית.',
      '',
      'כללים:',
      '- זהה מהבקשה מה הפעולה הנכונה: משימה, תזכורת, הוספת לקוח, או הוספת ליד — והפעל את הכלי המתאים.',
      '- זמנים: המר ביטויים יחסיים ("מחר בעשר", "בעוד שעתיים") לזמן מוחלט בפורמט ISO של שעון ישראל בלי אזור-זמן (למשל "2026-08-13T10:00"). ' +
        `השעה עכשיו בישראל: ${now}.`,
      '- ההבדל: "משימה" תופסת זמן ונכנסת ליומן; "תזכורת" היא רק נדנוד בזמן שנקבע.',
      '- הבחנה: "לקוח" = מי שכבר עובד איתו; "ליד" = מתעניין/הזדמנות מכירה.',
      '- אם הבקשה לא ברורה או חסר מידע (למשל אין שם/זמן) — שאל שאלה קצרה במקום לנחש.',
      '- אם הבקשה לא מתאימה לאף כלי — פשוט השב בקצרה ובאדיבות; אל תמציא פעולות.',
      '- כתוב תשובות קצרות. נסח אישורים בצורה עניינית (למשל "בוצע ✓ נקבעה תזכורת למחר ב-10:00") ' +
        'והימנע מפעלים בגוף שני שמניחים מגדר.',
    ].join('\n');
  }
}
