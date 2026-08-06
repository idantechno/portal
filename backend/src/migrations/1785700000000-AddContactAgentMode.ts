import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-contact agent behaviour: `agent_mode` (active | off | delayed) and, for
 * delayed mode, `agent_delay_minutes` — the window the owner gets to reply
 * before the agent steps in.
 *
 * Additive only: one defaulted column and one nullable column on
 * `customer_contacts`. Every existing contact starts `active` with no delay,
 * i.e. exactly today's behaviour.
 */
export class AddContactAgentMode1785700000000 implements MigrationInterface {
  name = 'AddContactAgentMode1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD "agent_mode" character varying(16) NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD "agent_delay_minutes" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP COLUMN "agent_delay_minutes"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP COLUMN "agent_mode"`,
    );
  }
}
