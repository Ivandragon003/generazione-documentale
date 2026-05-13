import type { TemplateEntity } from "../../entities/template.entity";
import { sha256Signature } from "../utils/signature.utils";

type TemplateResponseSource = Pick<
  TemplateEntity,
  "id" | "name" | "description" | "fields" | "created_at" | "updated_at"
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
  contentHash: string;
  fields: TemplateEntity["fields"];
  createdAt: Date;
  updatedAt: Date;
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
  contentHash: sha256Signature(template.content),
  fields: template.fields,
  createdAt: template.created_at,
  updatedAt: template.updated_at,
});
