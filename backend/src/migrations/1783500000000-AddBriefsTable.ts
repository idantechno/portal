import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBriefsTable1783500000000 implements MigrationInterface {
  name = 'AddBriefsTable1783500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "briefs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "lead_id" uuid, "title" character varying(255) NOT NULL, "markdown" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "website_url" character varying(512), "model" character varying(64), "payload" jsonb, "edited" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_briefs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_briefs_business_id" ON "briefs" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_briefs_lead_id" ON "briefs" ("lead_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_briefs_lead_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_briefs_business_id"`);
    await queryRunner.query(`DROP TABLE "briefs"`);
  }
}
