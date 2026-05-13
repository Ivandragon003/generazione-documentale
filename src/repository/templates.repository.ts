import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { type EntityManager, In, type Repository } from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { TemplateEntity } from "../entities/template.entity";

interface FindAllOptions {
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
}

interface UpdateTemplatePayload {
  id: string;
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
  ) {}

  async findAll({
    limit,
    offset,
  }: FindAllOptions): Promise<{ data: TemplateEntity[]; total: number }> {
    const baseQuery = this.templateRepository
      .createQueryBuilder("template")
      .orderBy("template.updated_at", "DESC");

    const [data, total] = await baseQuery
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { data, total };
  }

  async findById(id: string): Promise<TemplateEntity | null> {
    return this.templateRepository.findOne({ where: { id } });
  }

  async findByContentPaths(paths: string[]): Promise<TemplateEntity[]> {
    if (paths.length === 0) return [];
    return this.templateRepository.find({
      where: { content_path: In([...new Set(paths)]) },
    });
  }

  async findOneByContentPaths(paths: string[]): Promise<TemplateEntity | null> {
    if (paths.length === 0) return null;
    return this.templateRepository.findOne({
      where: { content_path: In([...new Set(paths)]) },
      order: { updated_at: "DESC" },
    });
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
      },
    );
    const updated = await manager.findOne(TemplateEntity, {
      where: { id: payload.id },
    });
    if (!updated) throw new Error("Template non trovato dopo update");
    return updated;
  }

  async countActiveDocuments(templateId: string): Promise<number> {
    const result = await this.templateRepository.manager
      .createQueryBuilder()
      .select("COUNT(*)", "count")
      .from("pdf_jobs", "j")
      .where("j.template_id = :templateId", { templateId })
      .getRawOne<{ count: string }>();
    return Number(result?.count ?? 0);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.templateRepository.delete({ id });
  }
}
