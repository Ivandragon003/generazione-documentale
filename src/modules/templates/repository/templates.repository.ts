import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import type { FieldDefinition } from "../../../common/types/field-definition.type";
import { DocumentEntity } from "../../../entities/document.entity";
import { TemplateEntity } from "../../../entities/template.entity";
import { TemplateVersionEntity } from "../../../entities/template-version.entity";

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
      status: "draft",
      version: 1,
      fields: payload.fields,
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
        version: payload.newVersion,
        fields: payload.fields,
      },
    );

    const template = await manager.findOne(TemplateEntity, {
      where: { id: payload.id },
    });
    if (!template) {
      throw new Error("Template aggiornato non trovato");
    }

    return template;
  }

  async publishTemplate(id: string): Promise<TemplateEntity | null> {
    await this.templateRepository.update({ id }, { status: "published" });
    return this.findById(id);
  }

  async findVersionById(
    id: string,
    version: number,
  ): Promise<TemplateVersionEntity | null> {
    return this.templateVersionRepository.findOne({
      where: { template_id: id, version },
    });
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

    const template = await manager.findOne(TemplateEntity, { where: { id } });
    if (!template) {
      throw new Error("Template ripristinato non trovato");
    }

    return template;
  }

  async findVersions(id: string): Promise<TemplateVersionEntity[]> {
    return this.templateVersionRepository.find({
      where: { template_id: id },
      order: { version: "DESC" },
    });
  }

  async countActiveDocuments(templateId: string): Promise<number> {
    return this.documentRepository
      .createQueryBuilder("document")
      .where("document.template_id = :templateId", { templateId })
      .andWhere("document.status != :archived", { archived: "archived" })
      .getCount();
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const deleted = await this.templateRepository.delete({ id });
    return (deleted.affected ?? 0) > 0;
  }
}
