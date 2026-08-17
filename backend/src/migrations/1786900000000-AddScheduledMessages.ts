import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `scheduled_messages` — outbound WhatsApp messages the owner asked the
 * concierge to send to a contact, now or at a future time. The minute sweep
 * delivers every `pending` row whose `send_at` has passed. Indexed by business
 * (per-tenant scope) and by send_at (the sweep's due-query).
 */
export class AddScheduledMessages1786900000000 implements MigrationInterface {
  name = 'AddScheduledMessages1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "scheduled_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "to_phone" character varying(32) NOT NULL,
        "to_name" character varying(200),
        "body" text NOT NULL,
        "send_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "failure_reason" text,
        "wamid" character varying(128),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_scheduled_messages" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scheduled_messages_business_id" ON "scheduled_messages" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scheduled_messages_send_at" ON "scheduled_messages" ("send_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_scheduled_messages_send_at"`);
    await queryRunner.query(`DROP INDEX "IDX_scheduled_messages_business_id"`);
    await queryRunner.query(`DROP TABLE "scheduled_messages"`);
  }
}
