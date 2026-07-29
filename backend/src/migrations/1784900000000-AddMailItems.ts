import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `mail_items` table backing the mail agent — one row per email the
 * triage engine flagged (today: invoice/receipt candidates) awaiting owner
 * approval. The composite unique index on (business_id, gmail_message_id) makes
 * the every-30-min sweep idempotent; the standalone business_id index scopes
 * per-tenant queries.
 *
 * `notifications.type` is a varchar column, so the new 'mail' type needs no
 * schema change.
 */
export class AddMailItems1784900000000 implements MigrationInterface {
  name = 'AddMailItems1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "mail_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "gmail_message_id" character varying NOT NULL,
        "detector" character varying(24) NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "from_address" character varying NOT NULL,
        "subject" character varying NOT NULL,
        "snippet" text,
        "received_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "has_attachment" boolean NOT NULL DEFAULT false,
        "attachment_name" character varying,
        "attachment_id" character varying,
        "attachment_mime" character varying,
        "expense_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mail_items" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_mail_items_business_gmail" ON "mail_items" ("business_id", "gmail_message_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mail_items_business_id" ON "mail_items" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_mail_items_business_id"`);
    await queryRunner.query(`DROP INDEX "IDX_mail_items_business_gmail"`);
    await queryRunner.query(`DROP TABLE "mail_items"`);
  }
}
