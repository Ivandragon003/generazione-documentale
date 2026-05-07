import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository, SelectQueryBuilder } from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { DocumentEntity } from "../entities/document.entity";
import { SectionEntity } from "../entities/section.entity";
import { TemplateEntity } from "../entities/template.entity";

interface FindAllOptions {
  status?: "draft" | "published";
  sectionId?: string;
  categoryId?: string;
  limit: number;
  offset: number;
}

interface InsertTemplatePayload {
  id: string;
  sectionId?: string;
  name: string;
  description?: string;
  contentPath: string;
  fields: FieldDefinition[];
  createdBy: string;
}

interface UpdateTemplatePayload {
  id: string;
  sectionId: string | null;
  name: string;
  description: string | null;
  contentPath: string;
  fields: FieldDefinition[];
}

@Injectable()
export class TemplatesRepository {
  constructor(
    @InjectRepository(TemplateEntity)
    private readonly templateRepository: Repository<TemplateEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(SectionEntity)
    private readonly sectionRepository: Repository<SectionEntity>,
  ) {}

  private withFilters(
    qb: SelectQueryBuilder<TemplateEntity>,
    { status, sectionId, categoryId }: Omit<FindAllOptions, "limit" | "offset">,
  ): SelectQueryBuilder<TemplateEntity> {
    if (status) {
      qb.andWhere("template.status = :status", { status });
    }
    if (sectionId) {
      qb.andWhere("template.section_id = :sectionId", { sectionId });
    }
    if (categoryId) {
      qb.innerJoin("sections", "section", "section.id = template.section_id");
      qb.andWhere("section.category_id = :categoryId", { categoryId });
    }
    return qb;
  }

  async findAll({
    status,
    sectionId,
    categoryId,
    limit,
    offset,
  }: FindAllOptions): Promise<{ data: TemplateEntity[]; total: number }> {
    const baseQuery = this.templateRepository
      .createQueryBuilder("template")
      .orderBy("template.updated_at", "DESC");

    this.withFilters(baseQuery, { status, sectionId, categoryId });
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
      section_id: payload.sectionId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      content_path: payload.contentPath,
      fields: payload.fields,
      status: "draft",
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
        section_id: payload.sectionId,
        name: payload.name,
        description: payload.description,
        content_path: payload.contentPath,
        fields: payload.fields,
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

  async sectionExists(sectionId: string): Promise<boolean> {
    const count = await this.sectionRepository.count({
      where: { id: sectionId },
    });
    return count > 0;
  }
}
