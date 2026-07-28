import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQuotes1784900000000 implements MigrationInterface {
  name = 'AddQuotes1784900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "quotes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "journey" text NOT NULL DEFAULT '', "channels" jsonb NOT NULL DEFAULT '[]'::jsonb, "budget_summary" text NOT NULL DEFAULT '', "total" character varying(64), "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_quotes_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotes_business_id" ON "quotes" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quotes_customer_id" ON "quotes" ("customer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_quotes_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_quotes_business_id"`);
    await queryRunner.query(`DROP TABLE "quotes"`);
  }
}
