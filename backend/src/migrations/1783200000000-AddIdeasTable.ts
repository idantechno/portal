import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdeasTable1783200000000 implements MigrationInterface {
  name = 'AddIdeasTable1783200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."ideas_status_enum" AS ENUM('seed', 'shaping', 'developed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ideas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "summary" text, "body" text NOT NULL DEFAULT '', "status" "public"."ideas_status_enum" NOT NULL DEFAULT 'seed', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ideas_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ideas_business_id" ON "ideas" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ideas_status" ON "ideas" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ideas_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ideas_business_id"`);
    await queryRunner.query(`DROP TABLE "ideas"`);
    await queryRunner.query(`DROP TYPE "public"."ideas_status_enum"`);
  }
}
