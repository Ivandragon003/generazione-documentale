import type { DocumentEntity } from "../../entities/document.entity";
import type { PdfJobEntity } from "../../entities/pdf-job.entity";
import type { TemplateEntity } from "../../entities/template.entity";

export interface TemplateResponseDto {
  id: string;
  sectionId: string | null;
  name: string;
  description: string | null;
  content: string;
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
  template: TemplateEntity & { content: string },
): TemplateResponseDto => ({
  id: template.id,
  sectionId: template.section_id,
  name: template.name,
  description: template.description,
  content: template.content,
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
