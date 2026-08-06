import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Write side of the schedule orchestrator: a dated to-do task can be mirrored
 * onto the owner's Google Calendar, tracked by `calendar_event_id`. Additive,
 * nullable — existing tasks simply aren't mirrored until next touched.
 */
export class AddTaskCalendarEventId1786000000000 implements MigrationInterface {
  name = 'AddTaskCalendarEventId1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "calendar_event_id" character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "calendar_event_id"`,
    );
  }
}
