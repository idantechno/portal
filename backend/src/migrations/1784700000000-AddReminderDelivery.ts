import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the reminders-delivery layer to tasks + businesses.
 *
 * On `tasks`:
 * - `remind_enabled` — master switch. The reminders sweep only fires a reminder
 *   for a task when this is true. Manual tasks default to OFF (the owner opts a
 *   task in with the 🔔 toggle); agent/appointment-created reminders default ON.
 * - `remind_at` — WHEN to fire the reminder, kept distinct from `due_at` (WHEN
 *   the event itself happens). Null falls back to `due_at`.
 * - `remind_customer_phone` — an extra WhatsApp recipient (the customer's own
 *   number) so the same reminder can also reach the customer, not just the owner.
 *
 * On `businesses`:
 * - `reminder_settings` — per-business default lead time + quiet-hours window the
 *   default reminder time is clamped into. Null = system defaults.
 *
 * Backfill: existing tasks created by an agent/automation are opted in (they were
 * already firing under the old all-due sweep); manual ones stay off so behaviour
 * matches the new "only what's marked" rule.
 */
export class AddReminderDelivery1784700000000 implements MigrationInterface {
  name = 'AddReminderDelivery1784700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "remind_enabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "remind_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "remind_customer_phone" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "remind_customer_name" character varying(255)`,
    );
    // Opt in the tasks that were already reminding under the old sweep.
    await queryRunner.query(
      `UPDATE "tasks" SET "remind_enabled" = true WHERE "source" IN ('agent', 'automation')`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "reminder_settings" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "reminder_settings"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "remind_customer_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "remind_customer_phone"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "remind_at"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "remind_enabled"`);
  }
}
