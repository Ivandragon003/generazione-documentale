import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository, SelectQueryBuilder } from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { DocumentEntity } from "../entities/document.entity";
import { TemplateEntity } from "../entities/template.entity";

interface FindAllOptions {
  status?: "draft" | "published";
  limit: number;
  offset: number;
}

interface InsertTemplatePayload {
  id: string;
  name: string;
  description?: string;
  contentPath: string;
  fields: FieldDefinition[];
  createdBy: string;
  status?: "draft" | "published";
}

interface UpdateTemplatePayload {
  id: string;
  name: string;
  description: string | null;
  contentPath: string;
  fields: FieldDefinition[];
  status: "draft" | "published";
}

@Injectable()
export class TemplatesRepository {
  constructor(
    @InjectRepository(TemplateEntity)
    private readonly templateRepository: Repository<TemplateEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
  ) {}

  private withFilters(
    qb: SelectQueryBuilder<TemplateEntity>,
    { status }: Omit<FindAllOptions, "limit" | "offset">,
  ): SelectQueryBuilder<TemplateEntity> {
    if (status) {
      qb.andWhere("template.status = :status", { status });
    }
    return qb;
  }

  async findAll({
    status,
    limit,
    offset,
  }: FindAllOptions): Promise<{ data: TemplateEntity[]; total: number }> {
    const baseQuery = this.templateRepository
      .createQueryBuilder("template")
      .orderBy("template.updated_at", "DESC");

    this.withFilters(baseQuery, { status });
    const [data, total] = await baseQuery
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { data, total };
  }

  async findById(id: string): Promise<TemplateEntity | null> {
    return this.templateRepository.findOne({ where: { id } });
  }

  async insertTemplate(
    manager: EntityManager,
    payload: InsertTemplatePayload,
  ): Promise<TemplateEntity> {
    const template = manager.create(TemplateEntity, {
      id: payload.id,
      name: payload.name,
      description: payload.description ?? null,
      content_path: payload.contentPath,
      fields: payload.fields,
      status: payload.status ?? "draft",
      created_by: payload.createdBy,
    });
    return manager.save(TemplateEntity, template);
  }

  async updateTemplate(
    manager: EntityManager,
    payload: UpdateTemplatePayload,
  ): Promise<TemplateEntity> {
    await manager.update(
      TemplateEntity,
      { id: payload.id },
      {
        name: payload.name,
        description: payload.description,
        content_path: payload.contentPath,
        fields: payload.fields,
        status: payload.status,
      },
    );
    const updated = await manager.findOne(TemplateEntity, {
      where: { id: payload.id },
    });
    if (!updated) throw new Error("Template non trovato dopo update");
    return updated;
  }

  async countActiveDocuments(templateId: string): Promise<number> {
    return this.documentRepository.count({
      where: { template_id: templateId },
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.templateRepository.delete({ id });
  }
}
