import type { FieldDefinition } from "../types/field-definition.type";
import { sha256Signature } from "../utils/signature.utils";

type TemplateResponseSource = {
  id: string;
  name: string;
  fields: FieldDefinition[];
  created_at: Date;
  updated_at: Date;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
};

export interface TemplateResponseDto {
  id: string;
  name: string;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
  contentHash: string;
  fields: FieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PdfJobResponseDto {
  id: string;
  templateId: string;
  status: string;
  filename: string | null;
  fieldValues: Record<string, unknown>;
  templateContentHash: string | null;
  fieldValuesHash: string | null;
  renderedContentHash: string | null;
  unresolvedFields: string[];
  errorMessage: string | null;
  requestedBy: string;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

export const toTemplateResponse = (
  template: TemplateResponseSource,
): TemplateResponseDto => ({
  id: template.id,
  name: template.name,
  content: template.content,
  githubPath: template.githubPath,
  category: template.category,
  section: template.section,
  contentHash: sha256Signature(template.content),
  fields: template.fields,
  createdAt: template.created_at,
  updatedAt: template.updated_at,
});

type PdfJobResponseSource = {
  id: string;
  template_id: string;
  status: string;
  filename: string | null;
  field_values: Record<string, unknown>;
  template_content_hash: string | null;
  field_values_hash: string | null;
  rendered_content_hash: string | null;
  unresolved_fields: string[];
  error_message: string | null;
  requested_by: string;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
};

export const toPdfJobResponse = (
  job: PdfJobResponseSource,
): PdfJobResponseDto => ({
  id: job.id,
  templateId: job.template_id,
  status: job.status,
  filename: job.filename,
  fieldValues: job.field_values,
  templateContentHash: job.template_content_hash,
  fieldValuesHash: job.field_values_hash,
  renderedContentHash: job.rendered_content_hash,
  unresolvedFields: job.unresolved_fields,
  errorMessage: job.error_message,
  requestedBy: job.requested_by,
  createdAt: job.created_at,
  startedAt: job.started_at,
  completedAt: job.completed_at,
});
