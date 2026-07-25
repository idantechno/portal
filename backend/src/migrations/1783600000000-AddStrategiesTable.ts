import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStrategiesTable1783600000000 implements MigrationInterface {
  name = 'AddStrategiesTable1783600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "strategies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "brief_id" uuid, "title" character varying(255) NOT NULL, "markdown" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "model" character varying(64), "payload" jsonb, "edited" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_strategies_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_strategies_business_id" ON "strategies" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_strategies_brief_id" ON "strategies" ("brief_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_strategies_brief_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_strategies_business_id"`);
    await queryRunner.query(`DROP TABLE "strategies"`);
  }
}
