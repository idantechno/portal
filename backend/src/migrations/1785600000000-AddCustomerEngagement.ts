import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-customer "engagement" — what this customer is actually getting from the
 * business (a plan, a project, or a one-off job like a video clip). The chat
 * agent fills `engagement_summary` from the conversation, but it stays
 * UNAPPROVED until the owner reviews it, so the agent never treats its own
 * guess as a business-confirmed fact.
 *
 * Additive only: three nullable/defaulted columns on `customers`, no indexes,
 * no backfill needed (every existing row starts with a null summary /
 * unapproved / no timestamp).
 */
export class AddCustomerEngagement1785600000000 implements MigrationInterface {
  name = 'AddCustomerEngagement1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "engagement_summary" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "engagement_approved" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "engagement_updated_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "engagement_updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "engagement_approved"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "engagement_summary"`,
    );
  }
}
