import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates `push_subscriptions` — one row per installed PWA / browser that has
 * opted into Web Push. Targeted by NotificationsService for the 'push' channel.
 * Scoped by business (+ optional user); `endpoint` unique so re-subscribing the
 * same device upserts rather than duplicating.
 */
export class AddPushSubscriptions1784300000000 implements MigrationInterface {
  name = 'AddPushSubscriptions1784300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "business_id" uuid NOT NULL,
        "user_id" uuid,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_push_subscriptions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_push_sub_endpoint" ON "push_subscriptions" ("endpoint")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_sub_business" ON "push_subscriptions" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_sub_user" ON "push_subscriptions" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
