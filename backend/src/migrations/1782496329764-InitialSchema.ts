import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1782496329764 implements MigrationInterface {
  name = 'InitialSchema1782496329764';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Required for uuid_generate_v4() defaults on a fresh database (managed
    // Postgres like Railway doesn't enable it by default).
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TABLE "business_members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "user_id" uuid NOT NULL, "role" character varying(16) NOT NULL DEFAULT 'agent', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0665f675783d42efe8fb5e5697c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_123f737f36b33e71fe0b3028fd" ON "business_members"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a8eebc9f4792ffdc2d350643f" ON "business_members"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_business_member" ON "business_members"  ("business_id", "user_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "businesses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'active', "slug" character varying(64) NOT NULL, "owner_user_id" uuid NOT NULL, "public_key" character varying(32) NOT NULL, "public_key_enabled" boolean NOT NULL DEFAULT true, "system_prompt_override" text, "widget_allowed_origins" jsonb NOT NULL DEFAULT '[]'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bc1bf63498dd2368ce3dc8686e8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_82ca19bc20713fdfa72626a5da" ON "businesses"  ("slug") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_85583909685483da083b9115a9" ON "businesses"  ("public_key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actor_user_id" uuid, "actor_email" character varying(255), "actor_role" character varying(32), "action" character varying(64) NOT NULL, "business_id" uuid, "target_type" character varying(32), "target_id" character varying(128), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_910f64d901a5c3e9878f0d4a407" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da4e1f7755a2ab9a8b7ddefaa4" ON "audit_events"  ("actor_user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68d908019304f757740bc47a0a" ON "audit_events"  ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ec3442ff0e334789e068f0cf9b" ON "audit_events"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "business_agents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "agent_key" character varying(32) NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "config" jsonb NOT NULL DEFAULT '{}'::jsonb, "granted_by_user_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_49a72719ba64f7e9e8f6818f473" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_23cbb14bb531fd5aab2bde1404" ON "business_agents"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_business_agent" ON "business_agents"  ("business_id", "agent_key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "context_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "relative_path" character varying(512) NOT NULL, "mime_type" character varying(128) NOT NULL, "size" bigint NOT NULL, "hidden_for_business" boolean NOT NULL DEFAULT false, "uploaded_by_user_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_14b3e42db3de4739f53e29892ff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_670ba0bab7457cb221d2688bc0" ON "context_files"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_context_file_path" ON "context_files"  ("business_id", "relative_path") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_channel_enum" AS ENUM('web', 'whatsapp', 'instagram')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_status_enum" AS ENUM('bot', 'human', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "channel" "public"."conversations_channel_enum" NOT NULL, "external_thread_id" character varying(255) NOT NULL, "customer_contact_id" uuid NOT NULL, "status" "public"."conversations_status_enum" NOT NULL DEFAULT 'bot', "assigned_agent_user_id" uuid, "last_message_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d2ec6f5e4d9d16443e841ed4d8" ON "conversations"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_87e3d3da5974ddb47063f8e9f4" ON "conversations"  ("customer_contact_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_517acf7e04a7232adb0c760c4b" ON "conversations"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9185e4a10f53167d15f23e1720" ON "conversations"  ("last_message_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."customer_contacts_channel_enum" AS ENUM('web', 'whatsapp', 'instagram')`,
    );
    await queryRunner.query(
      `CREATE TABLE "customer_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "channel" "public"."customer_contacts_channel_enum" NOT NULL, "external_id" character varying(255) NOT NULL, "display_name" character varying(255), "phone" character varying(64), "email" character varying(255), "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bde619dbcb45a3e4d542e137bd3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e62a9fc7ef2429610c3960bd33" ON "customer_contacts"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_contact_external" ON "customer_contacts"  ("business_id", "channel", "external_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_role_enum" AS ENUM('customer', 'bot', 'agent', 'system', 'tool')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "business_id" uuid NOT NULL, "role" "public"."messages_role_enum" NOT NULL, "content" text NOT NULL, "content_json" jsonb, "agent_user_id" uuid, "external_message_id" character varying(255), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3bc55a7c3f9ed54b520bb5cfe2" ON "messages"  ("conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1fe66d9cd8e2d40ddd8994d703" ON "messages"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0777b63da90c27d6ed993dc60b" ON "messages"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_templates_delivery_mode_enum" AS ENUM('client_sign', 'owner_send')`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(64) NOT NULL, "name_he" character varying(255) NOT NULL, "version" integer NOT NULL DEFAULT '1', "delivery_mode" "public"."document_templates_delivery_mode_enum" NOT NULL, "variable_schema" jsonb NOT NULL, "html_template" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0372838b7b7cd3571aef80466d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b87adb0356ed3090298a6e2965" ON "document_templates"  ("key") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."document_instances_status_enum" AS ENUM('draft', 'sent', 'signed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "document_instances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "template_id" uuid NOT NULL, "template_snapshot" jsonb NOT NULL, "variables" jsonb NOT NULL, "status" "public"."document_instances_status_enum" NOT NULL DEFAULT 'draft', "public_token" character varying(64), "recipient_fields" jsonb, "signature_svg" text, "signed_at" TIMESTAMP WITH TIME ZONE, "signed_pdf_path" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0bd57b48f80b765a8c9c5763b25" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_027c0ec933c88979d5d3ed4adf" ON "document_instances"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56c33117575f207da85cf25942" ON "document_instances"  ("template_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41899a4de0aa7d1405a0da9528" ON "document_instances"  ("status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_6fa256c7449188f293f108f246" ON "document_instances"  ("public_token") `,
    );
    await queryRunner.query(
      `CREATE TABLE "business_template_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "template_id" uuid NOT NULL, "boilerplate" jsonb NOT NULL DEFAULT '{}'::jsonb, "brand" jsonb NOT NULL DEFAULT '{}'::jsonb, "is_enabled" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f881884f7c3811b09a0ca83e879" UNIQUE ("business_id", "template_id"), CONSTRAINT "PK_bd184802677b034d91ac5a3a5c7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_713779c3f5d2fd03ba588a66d9" ON "business_template_configs"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94d9c9a8a7f71ede845c16d154" ON "business_template_configs"  ("template_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "leads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "customer_contact_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "phone" character varying(64), "email" character varying(255), "interest" text NOT NULL, "notes" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cd102ed7a9a4ca7d4d8bfeba406" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0a4e4def4110a83bd59fca3ddb" ON "leads"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_505de59092e7e3ae80260f3cd0" ON "leads"  ("conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf2e4447185cd3ab9c9e2616a5" ON "leads"  ("customer_contact_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0aa12c215b12c0e60fc3e82619" ON "leads"  ("created_at") `,
    );
    await queryRunner.query(
      `CREATE TABLE "whatsapp_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid NOT NULL, "phone_number_id" character varying(64), "waba_id" character varying(64), "meta_business_id" character varying(64), "display_phone_number" character varying(64), "access_token_encrypted" text, "status" character varying(16) NOT NULL DEFAULT 'pending', "last_error" text, "connected_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4d915053dc347cfe8dfc6efbb33" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_db3b704c8100b3ca8113c0b9f5" ON "whatsapp_connections"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_38366eae37d481aca2d5958884" ON "whatsapp_connections"  ("phone_number_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "name" character varying(255) NOT NULL, "role" character varying(32) NOT NULL DEFAULT 'member', "status" character varying(16) NOT NULL DEFAULT 'active', "default_business_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE TABLE "whatsapp_webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "business_id" uuid, "raw_payload" jsonb NOT NULL, "signature_ok" boolean NOT NULL, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ca84c91076d13d280b9bb9537d1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_44ac0af7e6eb7417cc764adf7b" ON "whatsapp_webhook_events"  ("business_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2c243ec807d24235ae3d66e1ec" ON "whatsapp_webhook_events"  ("created_at") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2c243ec807d24235ae3d66e1ec"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_44ac0af7e6eb7417cc764adf7b"`,
    );
    await queryRunner.query(`DROP TABLE "whatsapp_webhook_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_38366eae37d481aca2d5958884"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_db3b704c8100b3ca8113c0b9f5"`,
    );
    await queryRunner.query(`DROP TABLE "whatsapp_connections"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0aa12c215b12c0e60fc3e82619"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bf2e4447185cd3ab9c9e2616a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_505de59092e7e3ae80260f3cd0"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0a4e4def4110a83bd59fca3ddb"`,
    );
    await queryRunner.query(`DROP TABLE "leads"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_94d9c9a8a7f71ede845c16d154"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_713779c3f5d2fd03ba588a66d9"`,
    );
    await queryRunner.query(`DROP TABLE "business_template_configs"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6fa256c7449188f293f108f246"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41899a4de0aa7d1405a0da9528"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_56c33117575f207da85cf25942"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_027c0ec933c88979d5d3ed4adf"`,
    );
    await queryRunner.query(`DROP TABLE "document_instances"`);
    await queryRunner.query(
      `DROP TYPE "public"."document_instances_status_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b87adb0356ed3090298a6e2965"`,
    );
    await queryRunner.query(`DROP TABLE "document_templates"`);
    await queryRunner.query(
      `DROP TYPE "public"."document_templates_delivery_mode_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0777b63da90c27d6ed993dc60b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1fe66d9cd8e2d40ddd8994d703"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3bc55a7c3f9ed54b520bb5cfe2"`,
    );
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_contact_external"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e62a9fc7ef2429610c3960bd33"`,
    );
    await queryRunner.query(`DROP TABLE "customer_contacts"`);
    await queryRunner.query(
      `DROP TYPE "public"."customer_contacts_channel_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9185e4a10f53167d15f23e1720"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_517acf7e04a7232adb0c760c4b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_87e3d3da5974ddb47063f8e9f4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d2ec6f5e4d9d16443e841ed4d8"`,
    );
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_channel_enum"`);
    await queryRunner.query(`DROP INDEX "public"."uq_context_file_path"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_670ba0bab7457cb221d2688bc0"`,
    );
    await queryRunner.query(`DROP TABLE "context_files"`);
    await queryRunner.query(`DROP INDEX "public"."uq_business_agent"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_23cbb14bb531fd5aab2bde1404"`,
    );
    await queryRunner.query(`DROP TABLE "business_agents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ec3442ff0e334789e068f0cf9b"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_68d908019304f757740bc47a0a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da4e1f7755a2ab9a8b7ddefaa4"`,
    );
    await queryRunner.query(`DROP TABLE "audit_events"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_85583909685483da083b9115a9"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_82ca19bc20713fdfa72626a5da"`,
    );
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP INDEX "public"."uq_business_member"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a8eebc9f4792ffdc2d350643f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_123f737f36b33e71fe0b3028fd"`,
    );
    await queryRunner.query(`DROP TABLE "business_members"`);
  }
}
