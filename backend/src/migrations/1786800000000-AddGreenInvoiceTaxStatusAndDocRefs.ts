import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two-mode legal invoicing via Green Invoice:
 *  - `green_invoice_connections.tax_status` — the issuing business's VAT
 *    registration (exempt → קבלה 400, licensed → חשבונית מס/קבלה 320).
 *  - `invoices.external_doc_id` / `external_doc_number` — the real legal
 *    document issued in Green Invoice when the invoice was marked paid.
 * All additive; existing rows default to עוסק פטור and no external document.
 */
export class AddGreenInvoiceTaxStatusAndDocRefs1786800000000 implements MigrationInterface {
  name = 'AddGreenInvoiceTaxStatusAndDocRefs1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "green_invoice_connections" ADD "tax_status" character varying(16) NOT NULL DEFAULT 'exempt'`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD "external_doc_id" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD "external_doc_number" character varying(64)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN "external_doc_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP COLUMN "external_doc_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "green_invoice_connections" DROP COLUMN "tax_status"`,
    );
  }
}
