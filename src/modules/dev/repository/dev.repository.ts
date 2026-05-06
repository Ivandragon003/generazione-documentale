import { Injectable } from "@nestjs/common";
import type { DataSource } from "typeorm";

interface FixtureTemplateInput {
  id: string;
  name: string;
  description: string;
  contentPath: string;
  fields: unknown[];
}

interface FixtureDocumentInput {
  id: string;
  name: string;
  templateId: string;
  content: string;
  fieldValues: Record<string, string>;
}

@Injectable()
export class DevRepository {
  constructor(private readonly dataSource: DataSource) {}

  async truncateAll(): Promise<void> {
    await this.dataSource.query(`
      TRUNCATE TABLE
        audit_log,
        pdf_jobs,
        document_versions,
        documents,
        template_versions,
        templates
      RESTART IDENTITY CASCADE
    `);
  }

  async insertFixtureTemplate(payload: FixtureTemplateInput): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
       VALUES ($1, $2, $3, $4, 'draft', 1, $5, 'dev-fixture')`,
      [
        payload.id,
        payload.name,
        payload.description,
        payload.contentPath,
        JSON.stringify(payload.fields),
      ],
    );
  }

  async insertFixtureTemplateVersion(
    templateId: string,
    contentPath: string,
    fields: unknown[],
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
       VALUES ($1, 1, $2, $3, 'draft', 'create_fixture', 'dev-fixture')`,
      [templateId, contentPath, JSON.stringify(fields)],
    );
  }

  async insertFixtureDocument(payload: FixtureDocumentInput): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO documents (id, name, template_id, template_version, content, field_values, status, created_by)
       VALUES ($1, $2, $3, 1, $4, $5, 'draft', 'dev-fixture')`,
      [
        payload.id,
        payload.name,
        payload.templateId,
        payload.content,
        JSON.stringify(payload.fieldValues),
      ],
    );
  }

  async insertFixtureDocumentVersion(
    documentId: string,
    content: string,
    fieldValues: Record<string, string>,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
       VALUES ($1, 1, $2, $3, 'create_fixture', 'dev-fixture')`,
      [documentId, content, JSON.stringify(fieldValues)],
    );
  }

  async insertFixturePdfJob(
    id: string,
    documentId: string,
    filename: string,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO pdf_jobs (id, document_id, status, filename, unresolved_fields, requested_by, started_at, completed_at)
       VALUES ($1, $2, 'completed', $3, '[]', 'dev-fixture', NOW(), NOW())`,
      [id, documentId, filename],
    );
  }
}
