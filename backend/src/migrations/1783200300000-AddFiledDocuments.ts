import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFiledDocuments1783200300000 implements MigrationInterface {
  name = 'AddFiledDocuments1783200300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "filed_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "folder" character varying(128) NOT NULL, "filename" character varying(255) NOT NULL, "relative_path" character varying(512) NOT NULL, "mime_type" character varying(128) NOT NULL, "size" bigint NOT NULL, "source" character varying(16) NOT NULL DEFAULT 'upload', "created_by_user_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_filed_documents_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_filed_documents_business_id" ON "filed_documents" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_filed_documents_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "filed_documents"`);
  }
}
