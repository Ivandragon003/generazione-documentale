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
