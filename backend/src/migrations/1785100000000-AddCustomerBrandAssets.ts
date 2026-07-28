import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerBrandAssets1785100000000 implements MigrationInterface {
  name = 'AddCustomerBrandAssets1785100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "brand_page_ready" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "brand_page_url" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "logo_ready" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "logo_url" character varying(512)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "logo_url"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "logo_ready"`);
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "brand_page_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "brand_page_ready"`,
    );
  }
}
