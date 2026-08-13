import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `owner_commands` — the audit + idempotency log for the owner's
 * WhatsApp concierge (messages the business owner sends from their own number to
 * the business number). The unique index on `wamid` makes a re-delivered webhook
 * a no-op; the business_id index scopes per-tenant reads.
 */
export class AddOwnerCommands1786700000000 implements MigrationInterface {
  name = 'AddOwnerCommands1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "owner_commands" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "from_phone" character varying(32) NOT NULL,
        "wamid" character varying(128) NOT NULL,
        "body" text NOT NULL,
        "reply" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_owner_commands" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_owner_commands_wamid" ON "owner_commands" ("wamid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_owner_commands_business_id" ON "owner_commands" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_owner_commands_business_id"`);
    await queryRunner.query(`DROP INDEX "IDX_owner_commands_wamid"`);
    await queryRunner.query(`DROP TABLE "owner_commands"`);
  }
}
