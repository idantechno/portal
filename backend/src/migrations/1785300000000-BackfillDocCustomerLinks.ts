import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill `customer_id` on documents that were generated before the customer
 * existed (e.g. a brief produced from the leads tab, `customer_id` NULL). They
 * link to a lead; once that lead became a customer, the docs should surface
 * under the customer. This connects them via the shared lead, then cascades to
 * strategies/plans (via their brief/strategy) and objectives (via their brief).
 * Idempotent — only fills NULLs.
 */
export class BackfillDocCustomerLinks1785300000000 implements MigrationInterface {
  name = 'BackfillDocCustomerLinks1785300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // briefs → customer via the shared lead
    await queryRunner.query(`
      UPDATE "briefs" b SET "customer_id" = c."id"
      FROM "customers" c
      WHERE b."customer_id" IS NULL
        AND b."lead_id" IS NOT NULL
        AND c."lead_id" = b."lead_id"
        AND c."business_id" = b."business_id"
    `);
    // strategies inherit from their brief
    await queryRunner.query(`
      UPDATE "strategies" s SET "customer_id" = b."customer_id"
      FROM "briefs" b
      WHERE s."customer_id" IS NULL
        AND s."brief_id" = b."id"
        AND b."customer_id" IS NOT NULL
    `);
    // plans inherit from their strategy
    await queryRunner.query(`
      UPDATE "plans" p SET "customer_id" = s."customer_id"
      FROM "strategies" s
      WHERE p."customer_id" IS NULL
        AND p."strategy_id" = s."id"
        AND s."customer_id" IS NOT NULL
    `);
    // objectives inherit from their brief
    await queryRunner.query(`
      UPDATE "objectives" o SET "customer_id" = b."customer_id"
      FROM "briefs" b
      WHERE o."customer_id" IS NULL
        AND o."brief_id" = b."id"
        AND b."customer_id" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Data backfill — not reversible (we can't tell which links were pre-existing).
  }
}
