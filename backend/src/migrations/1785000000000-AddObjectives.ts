import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddObjectives1785000000000 implements MigrationInterface {
  name = 'AddObjectives1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "objectives" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "customer_id" uuid, "brief_id" uuid, "title" character varying(255) NOT NULL, "markdown" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "model" character varying(64), "payload" jsonb, "edited" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_objectives_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_objectives_business_id" ON "objectives" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_objectives_customer_id" ON "objectives" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_objectives_brief_id" ON "objectives" ("brief_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_objectives_brief_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_objectives_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_objectives_business_id"`);
    await queryRunner.query(`DROP TABLE "objectives"`);
  }
}
