import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `businesses.notification_preferences` (jsonb, nullable) — the owner's
 * per-channel notification choices (email/WhatsApp on/off + target overrides)
 * set from the in-app notifications settings screen. Null = system defaults
 * (email on to the account address, WhatsApp on to owner_phone), so existing
 * rows keep today's behaviour with no backfill.
 */
export class AddNotificationPreferences1786600000000 implements MigrationInterface {
  name = 'AddNotificationPreferences1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "notification_preferences" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "notification_preferences"`,
    );
  }
}
