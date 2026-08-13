import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-business booking availability (open hours + inter-appointment buffer +
 * holidays). Additive, nullable — an existing business stays "always open for
 * bookings" until it declares hours, so no behaviour changes on deploy.
 */
export class AddBusinessAvailability1786100000000 implements MigrationInterface {
  name = 'AddBusinessAvailability1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "availability" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "availability"`,
    );
  }
}
