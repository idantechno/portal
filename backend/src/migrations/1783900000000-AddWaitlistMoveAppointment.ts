import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `move_appointment_id` to waitlist_entries: set when a freed slot is
 * offered to an existing customer to bring a LATER appointment forward (a "move
 * earlier" offer) rather than book a brand-new appointment.
 */
export class AddWaitlistMoveAppointment1783900000000 implements MigrationInterface {
  name = 'AddWaitlistMoveAppointment1783900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "waitlist_entries" ADD COLUMN "move_appointment_id" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "waitlist_entries" DROP COLUMN "move_appointment_id"`,
    );
  }
}
