import type { DocumentEntity } from "../../entities/document.entity";
import type { PdfJobEntity } from "../../entities/pdf-job.entity";
import type { TemplateEntity } from "../../entities/template.entity";

type TemplateResponseSource = Pick<
  TemplateEntity,
  | "id"
  | "name"
  | "description"
  | "status"
  | "fields"
  | "created_at"
  | "updated_at"
> & {
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
};

export interface TemplateResponseDto {
  id: string;
  name: string;
  description: string | null;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
  status: "draft" | "published";
  fields: TemplateEntity["fields"];
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentResponseDto {
  id: string;
  name: string;
  templateId: string | null;
  content: string;
  fieldValues: DocumentEntity["field_values"];
  status: "draft" | "generated" | "published" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

export interface PdfJobResponseDto {
  id: string;
  documentId: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export const toTemplateResponse = (
  template: TemplateResponseSource,
): TemplateResponseDto => ({
  id: template.id,
  name: template.name,
  description: template.description,
  content: template.content,
  githubPath: template.githubPath,
  category: template.category,
  section: template.section,
  status: template.status,
  fields: template.fields,
  createdAt: template.created_at,
  updatedAt: template.updated_at,
});

export const toDocumentResponse = (
  document: DocumentEntity,
): DocumentResponseDto => ({
  id: document.id,
  name: document.name,
  templateId: document.template_id,
  content: document.content,
  fieldValues: document.field_values,
  status: document.status,
  createdAt: document.created_at,
  updatedAt: document.updated_at,
});

export const toPdfJobResponse = (job: PdfJobEntity): PdfJobResponseDto => ({
  id: job.id,
  documentId: job.document_id,
  status: job.status,
  createdAt: job.created_at,
  startedAt: job.started_at,
  completedAt: job.completed_at,
});
