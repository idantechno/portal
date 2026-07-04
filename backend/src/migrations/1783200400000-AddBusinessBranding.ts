import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessBranding1783200400000 implements MigrationInterface {
  name = 'AddBusinessBranding1783200400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "branding" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "businesses" DROP COLUMN "branding"`);
  }
}
