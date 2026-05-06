import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { DocumentEntity } from "../database/entities/document.entity";
import { TemplateEntity } from "../database/entities/template.entity";
import { TemplateVersionEntity } from "../database/entities/template-version.entity";

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
}

interface InsertTemplateVersionPayload {
  templateId: string;
  version: number;
  contentPath: string;
  fields: FieldDefinition[];
  status: string;
  action: string;
  createdBy: string;
}

interface UpdateTemplatePayload {
  id: string;
  name: string;
  description: string | null;
  contentPath: string;
  fields: FieldDefinition[];
  newVersion: number;
}

@Injectable()
export class TemplatesRepository {
  constructor(
    @InjectRepository(TemplateEntity)
    private readonly templateRepository: Repository<TemplateEntity>,
    @InjectRepository(TemplateVersionEntity)
    private readonly templateVersionRepository: Repository<TemplateVersionEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
  ) {}

  async findAll({
    status,
    limit,
    offset,
  }: FindAllOptions): Promise<{ data: TemplateEntity[]; total: number }> {
    const where = status ? { status } : {};
    const [data, total] = await this.templateRepository.findAndCount({
      where,
      order: { updated_at: "DESC" },
      take: limit,
      skip: offset,
    });
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
      version: 1,
      status: "draft",
      created_by: payload.createdBy,
    });
    return manager.save(TemplateEntity, template);
  }

  async insertTemplateVersion(
    manager: EntityManager,
    payload: InsertTemplateVersionPayload,
  ): Promise<TemplateVersionEntity> {
    const version = manager.create(TemplateVersionEntity, {
      template_id: payload.templateId,
      version: payload.version,
      content_path: payload.contentPath,
      fields: payload.fields,
      status: payload.status,
      action: payload.action,
      created_by: payload.createdBy,
    });
    return manager.save(TemplateVersionEntity, version);
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
        version: payload.newVersion,
      },
    );
    const updated = await manager.findOne(TemplateEntity, {
      where: { id: payload.id },
    });
    if (!updated) throw new Error("Template non trovato dopo update");
    return updated;
  }

  async restoreTemplate(
    manager: EntityManager,
    id: string,
    contentPath: string,
    fields: FieldDefinition[],
    newVersion: number,
  ): Promise<TemplateEntity> {
    await manager.update(
      TemplateEntity,
      { id },
      {
        content_path: contentPath,
        fields,
        version: newVersion,
        status: "draft",
      },
    );
    const updated = await manager.findOne(TemplateEntity, { where: { id } });
    if (!updated) throw new Error("Template non trovato dopo restore");
    return updated;
  }

  async findVersions(templateId: string): Promise<TemplateVersionEntity[]> {
    return this.templateVersionRepository.find({
      where: { template_id: templateId },
      order: { version: "DESC" },
    });
  }

  async findVersionById(
    templateId: string,
    version: number,
  ): Promise<TemplateVersionEntity | null> {
    return this.templateVersionRepository.findOne({
      where: { template_id: templateId, version },
    });
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
