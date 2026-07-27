import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `notified_at` to tasks — the marker the reminders scheduler stamps once
 * it has delivered a task's due-date reminder, so a due task fires exactly once.
 * Nullable; existing rows default to NULL (not yet notified).
 */
export class AddTaskNotifiedAt1784200000000 implements MigrationInterface {
  name = 'AddTaskNotifiedAt1784200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN "notified_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "notified_at"`);
  }
}
