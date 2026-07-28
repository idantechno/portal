import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaignProductionAnswers1785200000000 implements MigrationInterface {
  name = 'AddCampaignProductionAnswers1785200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" ADD "production_answers" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "campaigns" DROP COLUMN "production_answers"`,
    );
  }
}
