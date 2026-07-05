import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpenses1783200600000 implements MigrationInterface {
  name = 'AddExpenses1783200600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "kind" character varying(16) NOT NULL DEFAULT 'occasional', "amount_cents" integer, "currency" character varying(8) NOT NULL DEFAULT 'ILS', "expense_date" date, "file_name" character varying(255), "relative_path" character varying(512), "mime_type" character varying(128), "size" integer, "status" character varying(16) NOT NULL DEFAULT 'pending', "note" text, "created_by_user_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_expenses_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_expenses_business_id" ON "expenses" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_expenses_business_id"`);
    await queryRunner.query(`DROP TABLE "expenses"`);
  }
}
