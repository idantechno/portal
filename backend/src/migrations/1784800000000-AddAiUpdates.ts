import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `ai_updates` table backing the AI-updates agent — one row per
 * globally-generated digest, distinguished by `scope`:
 * - 'business' — daily AI-news digest shown to all entitled tenants;
 * - 'internal' — weekly Anthropic/Claude digest, operator-only.
 *
 * `items` and `sources` are jsonb arrays ({headline,detail} / {title,url}).
 * `notifications.type` is a varchar column, so the new 'ai-update' type needs
 * no schema change.
 */
export class AddAiUpdates1784800000000 implements MigrationInterface {
  name = 'AddAiUpdates1784800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ai_updates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "scope" character varying(16) NOT NULL,
        "title" character varying(255) NOT NULL,
        "summary" text NOT NULL,
        "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "sources" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_updates" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_updates_scope" ON "ai_updates" ("scope")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ai_updates_created_at" ON "ai_updates" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_ai_updates_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_ai_updates_scope"`);
    await queryRunner.query(`DROP TABLE "ai_updates"`);
  }
}
