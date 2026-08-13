import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { AgentChatMessage, AgentChatRole } from './agent-chat-message.entity';

/** How long a workspace chat is kept. */
const RETENTION_DAYS = 30;
/** Hard cap on turns returned/kept per thread, newest-biased. */
const MAX_TURNS = 400;

export interface ChatTurnInput {
  role: AgentChatRole;
  content: string;
}

@Injectable()
export class AgentChatService {
  constructor(
    @InjectRepository(AgentChatMessage)
    private readonly repo: Repository<AgentChatMessage>,
  ) {}

  private cutoff(): Date {
    return new Date(Date.now() - RETENTION_DAYS * 24 * 3_600_000);
  }

  /**
   * The last 30 days of a thread, oldest-first so it renders top-to-bottom.
   * Capped at MAX_TURNS (keeps the newest by fetching DESC then reversing).
   */
  async history(
    businessId: string,
    agentKey: string,
  ): Promise<AgentChatMessage[]> {
    const rows = await this.repo.find({
      where: { businessId, agentKey },
      order: { createdAt: 'DESC' },
      take: MAX_TURNS,
    });
    const cutoff = this.cutoff();
    return rows.filter((r) => r.createdAt >= cutoff).reverse();
  }

  /**
   * Append turns (typically the user message + the agent's reply), then
   * opportunistically purge this thread's rows older than the retention window —
   * no separate scheduler required. Empty/whitespace turns are skipped.
   */
  async append(
    businessId: string,
    agentKey: string,
    turns: ChatTurnInput[],
  ): Promise<void> {
    const rows = turns
      .filter((t) => t.content && t.content.trim())
      .map((t) =>
        this.repo.create({
          businessId,
          agentKey,
          role: t.role,
          content: t.content,
        }),
      );
    if (rows.length === 0) return;
    await this.repo.save(rows);
    // Best-effort purge of this thread's expired turns.
    await this.repo
      .delete({ businessId, agentKey, createdAt: LessThan(this.cutoff()) })
      .catch(() => undefined);
  }

  /** Wipe a thread (the "נקה שיחה" action). */
  async clear(businessId: string, agentKey: string): Promise<void> {
    await this.repo.delete({ businessId, agentKey });
  }
}
