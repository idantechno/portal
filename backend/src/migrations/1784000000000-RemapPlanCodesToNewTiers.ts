import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pricing was reworked from free/growth/scale to the three paid tiers
 * basic/growth/exclusive (see billing-plans.ts). Existing subscription rows
 * still carry the retired codes, and the new capability layer maps an unknown
 * plan code to NO capabilities — which would silently switch off the chat agent
 * and every feature for existing tenants. Remap them:
 *   free  → basic       (entry paid tier)
 *   scale → exclusive   (top tier)
 *   growth stays growth
 * Also update the column default. Data-only + default change; no schema shape
 * change.
 */
export class RemapPlanCodesToNewTiers1784000000000
  implements MigrationInterface
{
  name = 'RemapPlanCodesToNewTiers1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "plan_code" SET DEFAULT 'basic'`,
    );
    await queryRunner.query(
      `UPDATE "subscriptions" SET "plan_code" = 'basic' WHERE "plan_code" = 'free'`,
    );
    await queryRunner.query(
      `UPDATE "subscriptions" SET "plan_code" = 'exclusive' WHERE "plan_code" = 'scale'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "subscriptions" SET "plan_code" = 'scale' WHERE "plan_code" = 'exclusive'`,
    );
    await queryRunner.query(
      `UPDATE "subscriptions" SET "plan_code" = 'free' WHERE "plan_code" = 'basic'`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ALTER COLUMN "plan_code" SET DEFAULT 'free'`,
    );
  }
}
