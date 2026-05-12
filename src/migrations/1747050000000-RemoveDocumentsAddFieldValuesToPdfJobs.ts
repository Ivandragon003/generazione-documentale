import type { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveDocumentsAddFieldValuesToPdfJobs1747050000000
  implements MigrationInterface
{
  name = "RemoveDocumentsAddFieldValuesToPdfJobs1747050000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop pdf_jobs FK + index su document_id
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" DROP CONSTRAINT IF EXISTS "FK_pdf_jobs_document_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_pdf_jobs_document_id"`,
    );

    // 2. Aggiungi colonne nuove su pdf_jobs
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ADD COLUMN IF NOT EXISTS "template_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ADD COLUMN IF NOT EXISTS "field_values" jsonb NOT NULL DEFAULT '{}'`,
    );

    // 3. Drop vecchia colonna document_id
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" DROP COLUMN IF EXISTS "document_id"`,
    );

    // 4. template_id NOT NULL + FK verso templates
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ALTER COLUMN "template_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs"
       ADD CONSTRAINT "FK_pdf_jobs_template_id"
       FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pdf_jobs_template_id" ON "pdf_jobs" ("template_id")`,
    );

    // 5. Drop tabella documents
    await queryRunner.query(`DROP TABLE IF EXISTS "documents" CASCADE`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Ricrea documents (struttura minimale per rollback)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "template_id" uuid,
        "content" text NOT NULL DEFAULT '',
        "field_values" jsonb NOT NULL DEFAULT '{}',
        "status" varchar(50) NOT NULL DEFAULT 'draft',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`ALTER TABLE "pdf_jobs" DROP CONSTRAINT IF EXISTS "FK_pdf_jobs_template_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pdf_jobs_template_id"`);
    await queryRunner.query(`ALTER TABLE "pdf_jobs" ADD COLUMN IF NOT EXISTS "document_id" uuid`);
    await queryRunner.query(`ALTER TABLE "pdf_jobs" DROP COLUMN IF EXISTS "template_id"`);
    await queryRunner.query(`ALTER TABLE "pdf_jobs" DROP COLUMN IF EXISTS "field_values"`);
  }
}
