import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WhatsApp agent upgrade — packages A/B/C schema:
 *  - customer_contacts: relationship status (lead/customer) + operator notes
 *  - businesses: owner private phone for alerts
 *  - appointments: agent-booked / manual appointments (mirrored to calendar)
 *  - waitlist_entries: queue offered a freed slot when an appointment cancels
 */
export class AddAppointmentsWaitlistContactStatus1783800000000 implements MigrationInterface {
  name = 'AddAppointmentsWaitlistContactStatus1783800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- customer_contacts: status + notes ---
    await queryRunner.query(
      `CREATE TYPE "public"."customer_contacts_status_enum" AS ENUM('lead', 'customer')`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD COLUMN "status" "public"."customer_contacts_status_enum" NOT NULL DEFAULT 'lead'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD COLUMN "notes" text`,
    );

    // --- businesses: owner private phone ---
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "owner_phone" character varying(32)`,
    );

    // --- appointments ---
    await queryRunner.query(
      `CREATE TYPE "public"."appointments_status_enum" AS ENUM('scheduled', 'cancelled', 'completed', 'no_show')`,
    );
    await queryRunner.query(
      `CREATE TABLE "appointments" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"business_id" uuid NOT NULL, ` +
        `"customer_contact_id" uuid, ` +
        `"conversation_id" uuid, ` +
        `"title" character varying(255) NOT NULL, ` +
        `"start_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"end_at" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"status" "public"."appointments_status_enum" NOT NULL DEFAULT 'scheduled', ` +
        `"customer_name" character varying(255), ` +
        `"phone" character varying(64), ` +
        `"notes" text, ` +
        `"calendar_event_id" character varying(255), ` +
        `"source" character varying(16) NOT NULL DEFAULT 'agent', ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_appointments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_business_id" ON "appointments" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_appointments_customer_contact_id" ON "appointments" ("customer_contact_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_appointment_business_start" ON "appointments" ("business_id", "start_at")`,
    );

    // --- waitlist_entries ---
    await queryRunner.query(
      `CREATE TYPE "public"."waitlist_entries_status_enum" AS ENUM('waiting', 'offered', 'booked', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "waitlist_entries" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"business_id" uuid NOT NULL, ` +
        `"customer_contact_id" uuid, ` +
        `"conversation_id" uuid, ` +
        `"service" character varying(255) NOT NULL, ` +
        `"customer_name" character varying(255), ` +
        `"phone" character varying(64), ` +
        `"preferred_from" TIMESTAMP WITH TIME ZONE, ` +
        `"preferred_to" TIMESTAMP WITH TIME ZONE, ` +
        `"notes" text, ` +
        `"status" "public"."waitlist_entries_status_enum" NOT NULL DEFAULT 'waiting', ` +
        `"offered_at" TIMESTAMP WITH TIME ZONE, ` +
        `"offered_slot_start" TIMESTAMP WITH TIME ZONE, ` +
        `"created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_waitlist_entries" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_waitlist_business_id" ON "waitlist_entries" ("business_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_waitlist_customer_contact_id" ON "waitlist_entries" ("customer_contact_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_waitlist_business_status" ON "waitlist_entries" ("business_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_waitlist_business_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_waitlist_customer_contact_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_waitlist_business_id"`);
    await queryRunner.query(`DROP TABLE "waitlist_entries"`);
    await queryRunner.query(
      `DROP TYPE "public"."waitlist_entries_status_enum"`,
    );

    await queryRunner.query(
      `DROP INDEX "public"."idx_appointment_business_start"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_appointments_customer_contact_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_appointments_business_id"`,
    );
    await queryRunner.query(`DROP TABLE "appointments"`);
    await queryRunner.query(`DROP TYPE "public"."appointments_status_enum"`);

    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "owner_phone"`,
    );

    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP COLUMN "notes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."customer_contacts_status_enum"`,
    );
  }
}
