import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the business-agnostic quote structure — a free-text `intro` (scope) and
 * `line_items` (item · description · price) — alongside the legacy marketing
 * columns, which stay so older quotes keep rendering.
 */
export class AddQuoteLineItems1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "intro" text NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "line_items" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN IF EXISTS "line_items"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN IF EXISTS "intro"`,
    );
  }
}
