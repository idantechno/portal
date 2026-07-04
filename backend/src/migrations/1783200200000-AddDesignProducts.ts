import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesignProducts1783200200000 implements MigrationInterface {
  name = 'AddDesignProducts1783200200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "design_products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "kind" character varying(32) NOT NULL, "title" character varying(255) NOT NULL, "html" text NOT NULL, "content_summary" text, "primary_color" character varying(16), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_design_products_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_design_products_business_id" ON "design_products" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_design_products_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "design_products"`);
  }
}
