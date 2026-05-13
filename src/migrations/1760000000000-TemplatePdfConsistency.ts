import type { MigrationInterface, QueryRunner } from "typeorm";

export class TemplatePdfConsistency1760000000000 implements MigrationInterface {
  name = "TemplatePdfConsistency1760000000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "templates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "content_path" varchar(500),
        "fields" jsonb NOT NULL DEFAULT '[]',
        "created_by" varchar(255) NOT NULL DEFAULT 'system',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pdf_jobs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "template_id" uuid NOT NULL,
        "field_values" jsonb NOT NULL DEFAULT '{}',
        "status" varchar(50) NOT NULL DEFAULT 'queued',
        "filename" varchar(500),
        "template_content_hash" varchar(64),
        "field_values_hash" varchar(64),
        "rendered_content_hash" varchar(64),
        "unresolved_fields" jsonb NOT NULL DEFAULT '[]',
        "error_message" text,
        "requested_by" varchar(255) NOT NULL DEFAULT 'system',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "started_at" timestamptz,
        "completed_at" timestamptz
      )
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_pdf_jobs_template'
        ) THEN
          ALTER TABLE "pdf_jobs"
          ADD CONSTRAINT "fk_pdf_jobs_template"
          FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ck_pdf_jobs_status'
        ) THEN
          ALTER TABLE "pdf_jobs"
          ADD CONSTRAINT "ck_pdf_jobs_status"
          CHECK ("status" IN ('queued', 'running', 'completed', 'failed'));
        END IF;
      END $$;
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pdf_jobs_template_id" ON "pdf_jobs" ("template_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pdf_jobs_status" ON "pdf_jobs" ("status")`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_templates_status"`);
    await queryRunner.query(
      `ALTER TABLE "templates" DROP CONSTRAINT IF EXISTS "ck_templates_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "templates" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ADD COLUMN IF NOT EXISTS "template_content_hash" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ADD COLUMN IF NOT EXISTS "field_values_hash" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ADD COLUMN IF NOT EXISTS "rendered_content_hash" varchar(64)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pdf_jobs_latest_signature" ON "pdf_jobs" ("template_id", "status", "template_content_hash", "field_values_hash", "completed_at")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_pdf_jobs_latest_signature"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" DROP COLUMN IF EXISTS "rendered_content_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" DROP COLUMN IF EXISTS "field_values_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" DROP COLUMN IF EXISTS "template_content_hash"`,
    );
  }
}
