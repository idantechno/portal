import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupportRequests1783200100000 implements MigrationInterface {
  name = 'AddSupportRequests1783200100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "support_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "created_by_user_id" uuid, "subject" character varying(255) NOT NULL, "details" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'open', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_support_requests_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_requests_business_id" ON "support_requests" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_support_requests_status" ON "support_requests" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_support_requests_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_support_requests_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "support_requests"`);
  }
}
