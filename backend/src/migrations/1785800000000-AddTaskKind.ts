import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Splits the tasks table into "task" (a to-do the owner tracks) vs "reminder"
 * (a pure time-nudge). Both still live in `tasks`; `kind` is the discriminator
 * behind the calendar's "משימות" and "תזכורות" tabs.
 *
 * Additive: one defaulted column + index. Backfill marks the existing pure
 * nudges as reminders — agent-created rows that have a reminder enabled (the
 * reminders agent's own reminders and the auto-generated appointment
 * reminders). Everything else (manual/automation to-dos, agent follow-ups
 * without a reminder) stays a task.
 */
export class AddTaskKind1785800000000 implements MigrationInterface {
  name = 'AddTaskKind1785800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "kind" character varying(16) NOT NULL DEFAULT 'task'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_kind" ON "tasks" ("kind")`,
    );
    // Existing pure nudges → reminders (agent-made, reminder switched on).
    await queryRunner.query(
      `UPDATE "tasks" SET "kind" = 'reminder' WHERE "source" = 'agent' AND "remind_enabled" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_tasks_kind"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "kind"`);
  }
}
