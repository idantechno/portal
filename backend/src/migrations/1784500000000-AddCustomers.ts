import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomers1784500000000 implements MigrationInterface {
  name = 'AddCustomers1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "business_name" character varying(255), "phone" character varying(64), "email" character varying(255), "notes" text, "source" character varying(16) NOT NULL DEFAULT 'manual', "lead_id" uuid, "customer_contact_id" uuid, "became_customer_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "next_activity_at" TIMESTAMP WITH TIME ZONE, "next_activity_note" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_customers_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_business_id" ON "customers" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_lead_id" ON "customers" ("lead_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_customer_contact_id" ON "customers" ("customer_contact_id")`,
    );

    await queryRunner.query(`ALTER TABLE "briefs" ADD "customer_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_briefs_customer_id" ON "briefs" ("customer_id")`,
    );

    await queryRunner.query(`ALTER TABLE "strategies" ADD "customer_id" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_strategies_customer_id" ON "strategies" ("customer_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_strategies_customer_id"`);
    await queryRunner.query(
      `ALTER TABLE "strategies" DROP COLUMN "customer_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_briefs_customer_id"`);
    await queryRunner.query(`ALTER TABLE "briefs" DROP COLUMN "customer_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_customer_contact_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_customers_lead_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_customers_business_id"`);
    await queryRunner.query(`DROP TABLE "customers"`);
  }
}
