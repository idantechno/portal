import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessWhatsappAgent1783700000000 implements MigrationInterface {
  name = 'AddBusinessWhatsappAgent1783700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" ADD COLUMN "whatsapp_agent" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "businesses" DROP COLUMN "whatsapp_agent"`,
    );
  }
}
