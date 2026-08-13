import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional per-task duration (minutes). Additive, nullable — an existing dated
 * task keeps its flat 30-minute busy block until a duration is set, so nothing
 * changes on deploy.
 */
export class AddTaskDuration1786300000000 implements MigrationInterface {
  name = 'AddTaskDuration1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "duration_minutes" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN "duration_minutes"`,
    );
  }
}
