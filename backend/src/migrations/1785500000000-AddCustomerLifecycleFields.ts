import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 (additive, zero-risk) of the Contact/Lead/Customer unification.
 *
 * `customers` becomes the canonical "person" with a lifecycle `stage`. This
 * migration ONLY adds nullable/defaulted columns and plain (non-unique) indexes
 * and backfills them — no creation/write path changes, no unique constraints,
 * no FK-with-cascade, no changes to `leads`.
 *
 * Columns added to `customers`:
 *   - `stage`            varchar(16) NOT NULL DEFAULT 'customer'
 *   - `interest`         text NULL
 *   - `source_detail`    varchar(160) NULL
 *   - `captured_data`    jsonb NULL
 *   - `normalized_phone` varchar(16) NULL  (plain index)
 * Column added to `customer_contacts`:
 *   - `customer_id`      uuid NULL          (plain index, reverse link)
 *
 * Backfills:
 *   - stage = 'customer' for every existing row (existing customers ARE
 *     customers). The column default already covers this, but we set it
 *     explicitly for clarity/idempotency.
 *   - normalized_phone = last 9 digits of the digit-only phone, but only when
 *     the phone has >= 7 digits — mirroring `normalizePhoneKey` in
 *     customers.service.ts exactly (digits = replace(\D,''); if len < 7 → null;
 *     else digits.slice(-9)). In SQL: right(regexp_replace(phone,'\D','','g'),9)
 *     guarded by length(...) >= 7.
 *   - customer_contacts.customer_id backfilled from any customer already
 *     pointing at that contact via customers.customer_contact_id.
 */
export class AddCustomerLifecycleFields1785500000000 implements MigrationInterface {
  name = 'AddCustomerLifecycleFields1785500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- customers: new lifecycle columns --------------------------------
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "stage" character varying(16) NOT NULL DEFAULT 'customer'`,
    );
    await queryRunner.query(`ALTER TABLE "customers" ADD "interest" text`);
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "source_detail" character varying(160)`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "captured_data" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" ADD "normalized_phone" character varying(16)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customers_normalized_phone" ON "customers" ("normalized_phone")`,
    );

    // --- customer_contacts: reverse link to the canonical person ---------
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" ADD "customer_id" uuid`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_customer_contacts_customer_id" ON "customer_contacts" ("customer_id")`,
    );

    // --- Backfills (all additive, only fill NULL/defaults) ----------------
    // Existing customers ARE customers.
    await queryRunner.query(`UPDATE "customers" SET "stage" = 'customer'`);

    // Mirror normalizePhoneKey: digits-only, keep last 9, but only when the
    // number has >= 7 digits (never key on a fragment). Leave NULL otherwise.
    await queryRunner.query(`
      UPDATE "customers"
      SET "normalized_phone" =
        right(regexp_replace("phone", '\\D', '', 'g'), 9)
      WHERE "phone" IS NOT NULL
        AND length(regexp_replace("phone", '\\D', '', 'g')) >= 7
    `);

    // Reverse link: where a customer already points at a contact, mirror it
    // back onto the contact.
    await queryRunner.query(`
      UPDATE "customer_contacts" cc
      SET "customer_id" = c."id"
      FROM "customers" c
      WHERE c."customer_contact_id" = cc."id"
        AND cc."customer_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customer_contacts_customer_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_contacts" DROP COLUMN "customer_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_customers_normalized_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "normalized_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "captured_data"`,
    );
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN "source_detail"`,
    );
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "interest"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "stage"`);
  }
}
