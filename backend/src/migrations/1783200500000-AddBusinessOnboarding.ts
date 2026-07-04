import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessOnboarding1783200500000 implements MigrationInterface {
  name = 'AddBusinessOnboarding1783200500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "onboarding" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "onboarding"`,
    );
  }
}
