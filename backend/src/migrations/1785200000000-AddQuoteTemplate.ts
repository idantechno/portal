import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the per-quote PDF design choice (defaults to the 'classic' template). */
export class AddQuoteTemplate1785200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "template" varchar(24) NOT NULL DEFAULT 'classic'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN IF EXISTS "template"`,
    );
  }
}
