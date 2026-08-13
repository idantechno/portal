import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The business's accountant contact — the single locked recipient for the
 * "send financial documents to the accountant" action (button, agent command,
 * monthly auto). Additive + nullable; a business without it simply can't send
 * until one is set.
 */
export class AddAccountantRecipient1786500000000 implements MigrationInterface {
  name = 'AddAccountantRecipient1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "accountant_email" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD "accountant_phone" character varying(32)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "accountant_phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "accountant_email"`,
    );
  }
}
