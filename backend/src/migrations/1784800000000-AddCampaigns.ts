import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCampaigns1784800000000 implements MigrationInterface {
  name = 'AddCampaigns1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'building', "marketing_plan_id" uuid, "production_plan" jsonb, "schedule_horizon" character varying(16), "schedule" jsonb, "launched_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_campaigns_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaigns_business_id" ON "campaigns" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_campaigns_customer_id" ON "campaigns" ("customer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_campaigns_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_campaigns_business_id"`);
    await queryRunner.query(`DROP TABLE "campaigns"`);
  }
}
