import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a human-readable origin to leads ("וואטסאפ", "צ'אט באתר",
 * "שאלון אסטרטגיה · אינסטגרם"), so the leads table can show where each lead
 * actually came from rather than just agent-vs-questionnaire.
 */
export class AddLeadSourceDetail1783400000000 implements MigrationInterface {
  name = 'AddLeadSourceDetail1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "leads" ADD COLUMN "source_detail" character varying(160)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "leads" DROP COLUMN "source_detail"`);
  }
}
