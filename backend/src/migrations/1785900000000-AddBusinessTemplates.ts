import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-business WhatsApp-template grants — the catalog/entitlement layer for
 * templates, mirroring `business_agents`. A row overrides the catalog default
 * for one business (grant a special template, or revoke a base one). Absence of
 * a row = follow the catalog default.
 */
export class AddBusinessTemplates1785900000000 implements MigrationInterface {
  name = 'AddBusinessTemplates1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "business_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "template_name" character varying(64) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "granted_by_user_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_business_templates" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_business_templates_business_id" ON "business_templates" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_business_template" ON "business_templates" ("business_id", "template_name")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_business_template"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_business_templates_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "business_templates"`);
  }
}
