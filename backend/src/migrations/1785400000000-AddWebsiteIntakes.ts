import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `website_intakes` table backing the public `/website-brief` form:
 * a client's website brief (details, prices, products, location) plus a logo
 * and product images, attached to a deduped `Customer` under the platform
 * business. Assets live on the filesystem; only their metadata is stored here.
 */
export class AddWebsiteIntakes1785400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "website_intakes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "customer_id" uuid NOT NULL,
        "contact_name" varchar(255) NOT NULL,
        "business_name" varchar(255),
        "phone" varchar(64),
        "email" varchar(255),
        "sections" jsonb NOT NULL DEFAULT '[]',
        "logo" jsonb,
        "images" jsonb NOT NULL DEFAULT '[]',
        "public_token" varchar(64) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_website_intakes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_website_intakes_business" ON "website_intakes" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_website_intakes_customer" ON "website_intakes" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_website_intakes_public_token" ON "website_intakes" ("public_token")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_website_intakes_public_token"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_website_intakes_customer"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_website_intakes_business"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "website_intakes"`);
  }
}
