import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-business external CRM destination — where captured leads and booked
 * appointments are pushed so the owner keeps working in their own system. One
 * row per business (unique). The webhook URL + signing secret live encrypted in
 * `config_encrypted` (same AES as the WhatsApp tokens).
 */
export class AddCrmConnections1786400000000 implements MigrationInterface {
  name = 'AddCrmConnections1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "crm_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "type" character varying(32) NOT NULL DEFAULT 'webhook', "enabled" boolean NOT NULL DEFAULT true, "config_encrypted" text NOT NULL, "push_leads" boolean NOT NULL DEFAULT true, "push_appointments" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_crm_connections" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_crm_connection_business" ON "crm_connections" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."uq_crm_connection_business"`);
    await queryRunner.query(`DROP TABLE "crm_connections"`);
  }
}
