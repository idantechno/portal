import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Leads can now originate from a public marketing questionnaire (no chat),
 * so `conversation_id`/`customer_contact_id` become nullable, and we add
 * `source` (agent | questionnaire) plus an `answers` jsonb holding the full
 * structured submission.
 */
export class AddLeadSourceAndAnswers1783200800000 implements MigrationInterface {
  name = 'AddLeadSourceAndAnswers1783200800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "conversation_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "customer_contact_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN "source" character varying(16) NOT NULL DEFAULT 'agent'`,
    );
    await queryRunner.query(`ALTER TABLE "leads" ADD COLUMN "answers" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "answers"`);
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "source"`);
    // Best-effort restore of NOT NULL. Fails if questionnaire rows (with null
    // conversation/contact) exist — delete them first if reverting.
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "customer_contact_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "conversation_id" SET NOT NULL`,
    );
  }
}
