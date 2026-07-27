import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `deleted_at` to businesses — the soft-delete marker behind the two-stage
 * tenant deletion (30-day reversible window, then hard purge). TypeORM's
 * @DeleteDateColumn uses this to auto-exclude scheduled-for-deletion tenants
 * from every query. Nullable; existing rows default to NULL (not deleted).
 */
export class AddBusinessDeletedAt1784100000000 implements MigrationInterface {
  name = 'AddBusinessDeletedAt1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "deleted_at"`,
    );
  }
}
