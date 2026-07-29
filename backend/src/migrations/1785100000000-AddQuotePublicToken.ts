import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `public_token` column that authenticates a quote's public PDF link
 * (the shareable wa.me quote). The token is null until the operator shares the
 * quote; a partial unique index keeps tokens distinct without colliding on the
 * many null rows.
 */
export class AddQuotePublicToken1785100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "public_token" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_quotes_public_token" ON "quotes" ("public_token") WHERE "public_token" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quotes_public_token"`);
    await queryRunner.query(
      `ALTER TABLE "quotes" DROP COLUMN IF EXISTS "public_token"`,
    );
  }
}
