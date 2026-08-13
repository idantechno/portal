import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persistence for the owner↔agent workspace chats (Main/Designer/Documents/
 * Ideas/Reminders + generic workspace agents), so a conversation survives a
 * refresh. Retention is 30 days, enforced at the app layer (read filter + purge
 * on write). Scoped by (business_id, agent_key); one composite index serves both
 * the recent-history read and the purge.
 */
export class AddAgentChatMessages1786200000000 implements MigrationInterface {
  name = 'AddAgentChatMessages1786200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agent_chat_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "agent_key" character varying(64) NOT NULL, "role" character varying(16) NOT NULL, "content" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_agent_chat_messages" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_agent_chat_thread" ON "agent_chat_messages" ("business_id", "agent_key", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_agent_chat_thread"`);
    await queryRunner.query(`DROP TABLE "agent_chat_messages"`);
  }
}
