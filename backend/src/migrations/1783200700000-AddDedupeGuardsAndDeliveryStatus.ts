import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hardens the message/conversation dedupe paths with real DB guarantees and
 * adds outbound delivery tracking:
 *  - messages.delivery_status: 'sent' | 'failed' for outbound replies.
 *  - unique (business_id, external_message_id) partial index: an inbound wamid
 *    lands at most once, even under concurrent Meta retries.
 *  - unique (business_id, channel, external_thread_id): one conversation per
 *    thread, closing the findOrCreate check-then-insert race.
 *  - unique (business_id, number) on invoices: no duplicate invoice numbers.
 *
 * The three unique indexes assume no existing duplicates. At current tenant
 * scale that holds; if a future dataset has dupes, dedupe before deploying.
 */
export class AddDedupeGuardsAndDeliveryStatus1783200700000 implements MigrationInterface {
  name = 'AddDedupeGuardsAndDeliveryStatus1783200700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "delivery_status" character varying(16)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_message_external" ON "messages" ("business_id", "external_message_id") WHERE "external_message_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_conversation_thread" ON "conversations" ("business_id", "channel", "external_thread_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoice_number" ON "invoices" ("business_id", "number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_invoice_number"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_conversation_thread"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."uq_message_external"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP COLUMN IF EXISTS "delivery_status"`,
    );
  }
}
