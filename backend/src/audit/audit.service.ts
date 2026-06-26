import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEvent } from './audit-event.entity';

export interface RecordAuditInput {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  businessId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export interface ListAuditFilter {
  businessId?: string;
  actorUserId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEvent)
    private readonly events: Repository<AuditEvent>,
  ) {}

  /**
   * Best-effort: an audit write must never break the action it records, so any
   * failure is logged and swallowed.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      await this.events.save(
        this.events.create({
          actorUserId: input.actorUserId ?? null,
          actorEmail: input.actorEmail ?? null,
          actorRole: input.actorRole ?? null,
          action: input.action,
          businessId: input.businessId ?? null,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          metadata: input.metadata ?? {},
          ip: input.ip ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to write audit event "${input.action}": ${String(err)}`,
      );
    }
  }

  async list(
    filter: ListAuditFilter,
  ): Promise<{ items: AuditEvent[]; total: number }> {
    const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const offset = Math.max(filter.offset ?? 0, 0);
    const qb = this.events
      .createQueryBuilder('e')
      .orderBy('e.created_at', 'DESC')
      .take(limit)
      .skip(offset);
    if (filter.businessId) {
      qb.andWhere('e.business_id = :businessId', {
        businessId: filter.businessId,
      });
    }
    if (filter.actorUserId) {
      qb.andWhere('e.actor_user_id = :actorUserId', {
        actorUserId: filter.actorUserId,
      });
    }
    if (filter.action) {
      qb.andWhere('e.action = :action', { action: filter.action });
    }
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
