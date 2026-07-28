import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlans1784600000000 implements MigrationInterface {
  name = 'AddPlans1784600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "strategy_id" uuid, "customer_id" uuid, "title" character varying(255) NOT NULL, "markdown" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'draft', "model" character varying(64), "payload" jsonb, "edited" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_plans_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plans_business_id" ON "plans" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plans_strategy_id" ON "plans" ("strategy_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_plans_customer_id" ON "plans" ("customer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_plans_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plans_strategy_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_plans_business_id"`);
    await queryRunner.query(`DROP TABLE "plans"`);
  }
}
