import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { BusinessesService } from '../businesses/businesses.service';
import { Business } from '../businesses/business.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomerContactsService } from '../conversations/customer-contacts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Channel } from '../common/enums/channel.enum';
import { MessageRole } from '../common/enums/message-role.enum';
import { ConversationStatus } from '../common/enums/conversation-status.enum';
import { AccountStatus } from '../common/enums/account-status.enum';
import { Conversation } from '../conversations/conversation.entity';
import { Message } from '../conversations/message.entity';

const SESSION_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const generateSessionToken = customAlphabet(SESSION_ALPHABET, 32);

export interface ResolvedSession {
  business: Business;
  conversation: Conversation;
}

/**
 * Where a widget request claims to originate. `origin` is the browser's
 * `Origin` header (always present on the widget's cross-origin fetches);
 * `referer` is a fallback for the rare same-origin self-host where the
 * browser omits `Origin` but still sends `Referer`.
 */
export interface WidgetRequestOrigin {
  origin?: string | null;
  referer?: string | null;
}

/** Reduce a URL/origin string to a canonical `scheme://host[:port]`, or null. */
function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.trim()).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The web widget is unauthenticated — security model:
 * - `publicKey` identifies the business and gates session creation
 * - `sessionToken` (random 32-char) identifies one anonymous customer for
 *   subsequent calls; it doubles as the CustomerContact.externalId so the
 *   conversation is uniquely keyed in our channel-agnostic schema
 *
 * Anyone with the sessionToken can read/write the conversation it points at —
 * that's the same as any other widget chat across the industry.
 */
@Injectable()
export class WidgetService {
  private readonly log = new Logger(WidgetService.name);

  constructor(
    private readonly businesses: BusinessesService,
    private readonly contacts: CustomerContactsService,
    private readonly conversations: ConversationsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The business's configured allowlist, normalized (empty = not locked). */
  private normalizedAllowlist(business: Business): string[] {
    return (business.widgetAllowedOrigins ?? [])
      .map((o) => normalizeOrigin(o))
      .filter((o): o is string => o !== null);
  }

  /**
   * Reject a widget request coming from a site the business hasn't authorized.
   *
   * The `publicKey` is NOT a secret — it's visible in the embed snippet in any
   * customer's page source. Without this check, anyone could copy the key,
   * embed the widget on their own site, and drive billable agent runs on our
   * Anthropic key against this tenant. The `widgetAllowedOrigins` list is the
   * per-business whitelist of sites permitted to run the widget.
   *
   * Enforcement is opt-in per business: an empty list means "not yet locked
   * down — allow any origin" so existing embeds don't break. Once the operator
   * fills the list, only those exact origins (scheme + host + port) pass, and a
   * missing Origin (i.e. not a real browser cross-origin call) is rejected too.
   *
   * Note: `Origin` is trivially forgeable outside a browser (curl et al.), so
   * this stops *browser-based* embedding on unauthorized sites — the real abuse
   * vector — but is not a substitute for the per-IP rate limits on this route.
   */
  private assertOriginAllowed(
    business: Business,
    req: WidgetRequestOrigin | undefined,
  ): void {
    const allowed = this.normalizedAllowlist(business);
    if (allowed.length === 0) return; // not configured → permissive
    const requestOrigin =
      normalizeOrigin(req?.origin) ?? normalizeOrigin(req?.referer);
    if (requestOrigin && allowed.includes(requestOrigin)) return;
    throw new ForbiddenException('This widget is not authorized for this site');
  }

  /**
   * Watch which sites use a business's widget and raise an in-app notification
   * (the cockpit bell) so the operator can spot — and manually block — abuse.
   *
   * - Locked mode (allowlist filled): a request from an origin NOT on the list
   *   is alerted as a blocked attempt, then rejected by the caller with a 403.
   * - Open mode (allowlist empty): the FIRST session from any given domain is
   *   alerted as a new site — once per domain, not per session — so a stranger
   *   embedding the widget surfaces without drowning the bell in noise.
   *
   * Never throws: monitoring must not break a real customer's chat.
   */
  private async monitorWidgetOrigin(
    business: Business,
    requestOrigin: string | null,
  ): Promise<void> {
    try {
      const allowed = this.normalizedAllowlist(business);
      if (allowed.length > 0) {
        if (!requestOrigin || !allowed.includes(requestOrigin)) {
          await this.raiseOriginAlert(business, requestOrigin, 'blocked');
        }
        return;
      }
      // Open mode: alert only the first time a domain appears.
      if (
        requestOrigin &&
        !(await this.contacts.hasWebContactFromOrigin(
          business.id,
          requestOrigin,
        ))
      ) {
        await this.raiseOriginAlert(business, requestOrigin, 'new');
      }
    } catch (err) {
      this.log.warn(
        `[widget] origin monitoring failed for business ${business.id}: ${String(err)}`,
      );
    }
  }

  private raiseOriginAlert(
    business: Business,
    requestOrigin: string | null,
    kind: 'new' | 'blocked',
  ): Promise<unknown> {
    const domain = requestOrigin ?? 'מקור לא ידוע';
    const title =
      kind === 'blocked'
        ? `נחסמה שיחת צ'אט מאתר לא מורשה: ${domain}`
        : `אתר חדש התחיל להשתמש בצ'אט האתר: ${domain}`;
    const body =
      kind === 'blocked'
        ? `מישהו ניסה להפעיל את צ'אט האתר שלך מ-${domain}, שאינו ברשימת הדומיינים המורשים. הבקשה נחסמה. אם זה אתר לגיטימי, הוסף אותו בהגדרות → ווידג'ט אתר.`
        : `שיחת צ'אט חדשה נפתחה מהאתר ${domain}. אם אינך מזהה אותו, אפשר לנעול את הצ'אט לאתרים ידועים בלבד בהגדרות → ווידג'ט אתר.`;
    return this.notifications.notify({
      businessId: business.id,
      type: 'system',
      title,
      body,
      link: `/app/businesses/${business.id}/settings`,
      channels: ['email'],
    });
  }

  async createSession(
    publicKey: string,
    req?: WidgetRequestOrigin,
  ): Promise<{
    sessionToken: string;
    conversationId: string;
  }> {
    const business = await this.businesses.findByPublicKey(publicKey);
    if (!business) {
      throw new NotFoundException('Unknown widget public key');
    }
    // A suspended tenant's widget must not keep generating billable agent runs.
    if (business.status === AccountStatus.Suspended) {
      throw new NotFoundException('Unknown widget public key');
    }
    const requestOrigin =
      normalizeOrigin(req?.origin) ?? normalizeOrigin(req?.referer);
    // Monitor + alert BEFORE enforcing, so a blocked attempt still notifies.
    await this.monitorWidgetOrigin(business, requestOrigin);
    this.assertOriginAllowed(business, req);
    const sessionToken = generateSessionToken();
    const contact = await this.contacts.upsert({
      businessId: business.id,
      channel: Channel.Web,
      externalId: sessionToken,
      displayName: null,
      // Stamp the source site so it's visible on the conversation and so a
      // first-seen domain can be detected on the next session.
      metadata: requestOrigin ? { origin: requestOrigin } : undefined,
    });
    const conversation = await this.conversations.findOrCreate({
      businessId: business.id,
      channel: Channel.Web,
      externalThreadId: sessionToken,
      customerContactId: contact.id,
    });
    return { sessionToken, conversationId: conversation.id };
  }

  async resolve(
    sessionToken: string,
    req?: WidgetRequestOrigin,
  ): Promise<ResolvedSession> {
    const contact = await this.contacts.findByExternalId(
      Channel.Web,
      sessionToken,
    );
    if (!contact) throw new UnauthorizedException('Unknown session');
    const conversation = await this.conversations.findOrCreate({
      businessId: contact.businessId,
      channel: Channel.Web,
      externalThreadId: sessionToken,
      customerContactId: contact.id,
    });
    const business = await this.businesses.findById(contact.businessId);
    if (!business) throw new NotFoundException('Business not found');
    // A session token is per-customer, but the origin can still change if the
    // token is lifted and replayed from another site — re-check every call.
    this.assertOriginAllowed(business, req);
    return { business, conversation };
  }

  async sendCustomerMessage(
    sessionToken: string,
    content: string,
    req?: WidgetRequestOrigin,
  ): Promise<Message> {
    const { business, conversation } = await this.resolve(sessionToken, req);
    if (business.status === AccountStatus.Suspended) {
      throw new UnauthorizedException('This chat is not available');
    }
    if (conversation.status === ConversationStatus.Closed) {
      throw new UnauthorizedException('Conversation is closed');
    }
    return this.conversations.appendMessage({
      businessId: conversation.businessId,
      conversationId: conversation.id,
      role: MessageRole.Customer,
      content,
    });
  }

  async listMessages(
    sessionToken: string,
    options: { since?: Date } & WidgetRequestOrigin = {},
  ): Promise<{ messages: Message[]; conversationStatus: ConversationStatus }> {
    const { conversation } = await this.resolve(sessionToken, {
      origin: options.origin,
      referer: options.referer,
    });
    const all = await this.conversations.listMessages(
      conversation.businessId,
      conversation.id,
      { limit: 200 },
    );
    const messages = options.since
      ? all.filter(
          (m) =>
            // Only return messages strictly after `since` and only the
            // customer-visible roles. Internal "tool" + "system" stay hidden.
            new Date(m.createdAt) > options.since! &&
            m.role !== MessageRole.Tool &&
            m.role !== MessageRole.System,
        )
      : all.filter(
          (m) => m.role !== MessageRole.Tool && m.role !== MessageRole.System,
        );
    return { messages, conversationStatus: conversation.status };
  }
}
