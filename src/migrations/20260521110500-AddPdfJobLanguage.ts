import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddPdfJobLanguage20260521110500 implements MigrationInterface {
  name = "AddPdfJobLanguage20260521110500";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pdf_jobs" ADD "language" character varying(35)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pdf_jobs" DROP COLUMN "language"`);
  }
}
