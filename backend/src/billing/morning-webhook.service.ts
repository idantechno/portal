import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { User } from '../users/user.entity';
import { Business } from '../businesses/business.entity';
import { BillingService } from './billing.service';

/**
 * Outcome of processing one morning/GROW payment webhook. Returned to the
 * controller purely so it can be logged/traced — morning only cares that we
 * answered 2xx (we always do, so it stops retrying).
 */
export interface MorningWebhookResult {
  handled: boolean;
  reason: string;
}

/**
 * Receives payment notifications from morning (חשבונית ירוקה) / GROW and
 * upgrades the paying business's subscription.
 *
 * The hard part is identification: the GROW payment links are SHARED per plan
 * (every business buying "בסיס" opens the same link), so the webhook body does
 * not name the business or the plan. We recover both from the payload:
 *   - the payer's EMAIL  → the business whose owner logs in with that email
 *   - the paid AMOUNT    → the plan with that exact price (390/590/719 are unique)
 *
 * morning's exact field names aren't publicly documented in a fetchable form, so
 * extraction is deliberately tolerant (several candidate paths + a deep fallback)
 * and the FULL raw payload is logged on every hit. Once we've seen a real
 * delivery, tighten `extractEmail`/`extractAmountCents` to the confirmed shape.
 */
@Injectable()
export class MorningWebhookService {
  private readonly log = new Logger(MorningWebhookService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(Business)
    private readonly businesses: Repository<Business>,
  ) {}

  /**
   * Verify morning's `X-Data-Signature` header: HMAC-SHA256 of the raw body
   * keyed by our shared secret, compared in constant time. Returns false (never
   * throws) so the controller can log and ack. If no secret is configured we
   * return null = "cannot verify" and the caller decides how strict to be.
   */
  verifySignature(rawBody: Buffer, header: string | undefined): boolean | null {
    const secret = this.config.get<string>('MORNING_WEBHOOK_SECRET')?.trim();
    if (!secret) return null;
    if (!header) return false;
    // Accept either a bare hex digest or a "sha256=" prefixed one.
    const provided = header.startsWith('sha256=')
      ? header.slice('sha256='.length)
      : header;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (provided.length !== expected.length) return false;
    try {
      return timingSafeEqual(
        Buffer.from(provided, 'hex'),
        Buffer.from(expected, 'hex'),
      );
    } catch {
      return false;
    }
  }

  async handle(payload: unknown): Promise<MorningWebhookResult> {
    const email = this.extractEmail(payload);
    const amountCents = this.extractAmountCents(payload);
    this.log.log(
      `[morning] webhook received email=${email ?? 'none'} amountCents=${
        amountCents ?? 'none'
      } raw=${JSON.stringify(payload).slice(0, 1000)}`,
    );

    if (!email) {
      return this.miss('no payer email in payload');
    }
    if (amountCents == null) {
      return this.miss('no amount in payload');
    }

    const plan = this.billing.planForAmountCents(amountCents);
    if (!plan) {
      return this.miss(`no plan matches amount ${amountCents} agorot`);
    }

    const businessId = await this.findBusinessIdByOwnerEmail(email);
    if (!businessId) {
      return this.miss(`no business owned by ${email}`);
    }

    const ref = this.extractRef(payload);
    await this.billing.activateFromMorning(businessId, plan.code, ref);
    this.log.log(
      `[morning] activated business ${businessId} on plan ${plan.code} (ref=${ref ?? 'none'})`,
    );
    return { handled: true, reason: `activated ${plan.code}` };
  }

  /** Log-and-return helper for the many "can't act on this" branches. */
  private miss(reason: string): MorningWebhookResult {
    this.log.warn(`[morning] not activated: ${reason}`);
    return { handled: false, reason };
  }

  private async findBusinessIdByOwnerEmail(
    email: string,
  ): Promise<string | null> {
    const user = await this.users.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) return null;
    const business = await this.businesses.findOne({
      where: { ownerUserId: user.id },
    });
    return business?.id ?? null;
  }

  // --- Tolerant payload extraction ---------------------------------------
  // morning's field names are treated as provisional (see class docstring).

  private extractEmail(payload: unknown): string | null {
    const paths = [
      ['client', 'emails', 0],
      ['client', 'email'],
      ['data', 'client', 'emails', 0],
      ['payer', 'email'],
      ['email'],
    ];
    for (const path of paths) {
      const v = this.at(payload, path);
      if (typeof v === 'string' && v.includes('@')) return v;
    }
    // Fallback: first email-shaped string anywhere in the tree.
    return this.deepFind(
      payload,
      (v) => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    ) as string | null;
  }

  /** Returns the paid amount in agorot (₪ * 100), or null if none found. */
  private extractAmountCents(payload: unknown): number | null {
    const keys = ['sum', 'amount', 'total', 'price', 'paymentSum'];
    for (const key of keys) {
      const v = this.at(payload, [key]) ?? this.at(payload, ['data', key]);
      const shekels = this.toNumber(v);
      if (shekels != null && shekels > 0) return Math.round(shekels * 100);
    }
    return null;
  }

  private extractRef(payload: unknown): string | null {
    for (const key of ['id', 'documentId', 'paymentId', 'transactionId']) {
      const v = this.at(payload, [key]) ?? this.at(payload, ['data', key]);
      if (typeof v === 'string' && v) return v;
      if (typeof v === 'number') return String(v);
    }
    return null;
  }

  private toNumber(v: unknown): number | null {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  }

  /** Safely walk an object/array by a list of keys/indices. */
  private at(obj: unknown, path: Array<string | number>): unknown {
    let cur = obj;
    for (const key of path) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string | number, unknown>)[key];
    }
    return cur;
  }

  private deepFind(
    obj: unknown,
    pred: (v: unknown) => boolean,
    depth = 0,
  ): unknown {
    if (depth > 6 || obj == null) return null;
    if (pred(obj)) return obj;
    if (typeof obj === 'object') {
      for (const v of Object.values(obj as Record<string, unknown>)) {
        const found = this.deepFind(v, pred, depth + 1);
        if (found != null) return found;
      }
    }
    return null;
  }
}
