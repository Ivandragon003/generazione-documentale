import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { makeError } from "../common/utils/errors";
import { assertUuid } from "../common/utils/http.utils";
import {
  normalizeFieldDefinitions,
  type PartialFieldDefinition,
  validateMarkdownContent,
} from "../common/utils/markdown.utils";
import { appConfig } from "../config/app.config";
import type { TemplateEntity } from "../entities/template.entity";
import { TemplatesRepository } from "../repository/templates.repository";

export interface CreateTemplateInput {
  section_id?: string;
  name: string;
  description?: string;
  content: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
  status?: "draft" | "published";
}

export interface UpdateTemplateInput {
  section_id?: string | null;
  name?: string;
  description?: string;
  content?: string;
  fields?: PartialFieldDefinition[];
  status?: "draft" | "published";
}

const MAX_TEMPLATE_CONTENT_BYTES = appConfig.maxTemplateContentBytes;
const TEMPLATES_STORAGE_PATH = resolve(appConfig.templatesStoragePath);

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(TemplatesRepository)
    private readonly templatesRepository: TemplatesRepository,
  ) {}

  private assertValidContent(content: string): void {
    const result = validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
    if (!result.valid) throw makeError(result.errors.join("; "), 400);
  }

  private templateFilePath(contentPath: string): string {
    return join(TEMPLATES_STORAGE_PATH, contentPath);
  }

  private toStorageFilename(templateId: string): string {
    return `${templateId}.md`;
  }

  private async readTemplateContent(
    contentPath: string | null,
  ): Promise<string | null> {
    if (!contentPath) return null;
    try {
      return await readFile(this.templateFilePath(contentPath), "utf8");
    } catch (error) {
      this.logger.error(
        `Impossibile leggere template locale: ${contentPath}`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  private async writeTemplateContent(
    contentPath: string,
    content: string,
  ): Promise<void> {
    await mkdir(TEMPLATES_STORAGE_PATH, { recursive: true });
    await writeFile(this.templateFilePath(contentPath), content, "utf8");
  }

  private async deleteTemplateContent(
    contentPath: string | null,
  ): Promise<void> {
    if (!contentPath) return;
    await unlink(this.templateFilePath(contentPath)).catch(() => undefined);
  }

  private async hydrateContent<T extends { content_path: string | null }>(
    row: T | null,
  ): Promise<(T & { content: string }) | null> {
    if (!row) return null;
    const content = await this.readTemplateContent(row.content_path);
    if (content === null) {
      // Il file su disco non e disponibile: e un problema di infrastruttura, non un bug applicativo
      throw makeError("Contenuto template locale non disponibile", 503);
    }
    return { ...row, content };
  }

  private async findOneOrThrow(
    id: string,
  ): Promise<TemplateEntity & { content: string }> {
    assertUuid(id);
    const template = await this.findOne(id);
    if (!template) throw makeError("Template non trovato", 404);
    return template;
  }

  async findAll({
    status,
    sectionId,
    categoryId,
    limit = 20,
    offset = 0,
  }: {
    status?: "draft" | "published";
    sectionId?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { data, total } = await this.templatesRepository.findAll({
      status,
      sectionId,
      categoryId,
      limit,
      offset,
    });
    const hydratedData = await Promise.all(
      data.map((row) => this.hydrateContent(row)),
    );
    return {
      data: hydratedData.filter(
        (row): row is TemplateEntity & { content: string } => Boolean(row),
      ),
      total,
      limit,
      offset,
    };
  }

  async findOne(
    id: string,
  ): Promise<(TemplateEntity & { content: string }) | null> {
    assertUuid(id);
    const row = await this.templatesRepository.findById(id);
    return this.hydrateContent(row);
  }

  async create({
    section_id,
    name,
    description,
    content,
    fields,
    created_by = "system",
    status,
  }: CreateTemplateInput) {
    if (!name || name.trim().length === 0) {
      throw makeError("Il nome del template e obbligatorio", 400);
    }
    if (section_id) {
      assertUuid(section_id, "section_id");
      const sectionExists =
        await this.templatesRepository.sectionExists(section_id);
      if (!sectionExists) {
        throw makeError("section_id non esistente", 400);
      }
    }
    this.assertValidContent(content);
    const id = randomUUID();
    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      content,
      fields,
    );
    const contentPath = this.toStorageFilename(id);
    // Scrivi prima in un file temporaneo, poi rinomina atomicamente
    // solo dopo che la transazione DB e andata a buon fine
    const tmpPath = `${contentPath}.tmp`;
    await mkdir(TEMPLATES_STORAGE_PATH, { recursive: true });
    await writeFile(this.templateFilePath(tmpPath), content, "utf8");
    try {
      const template = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.insertTemplate(manager, {
          id,
          sectionId: section_id,
          name: name.trim(),
          description,
          contentPath,
          fields: normalizedFields,
          createdBy: created_by,
          status,
        }),
      );
      // DB ok -> promuovi il file temporaneo al percorso definitivo
      await rename(
        this.templateFilePath(tmpPath),
        this.templateFilePath(contentPath),
      );
      return this.hydrateContent(template);
    } catch (error) {
      // DB fallito o rename fallita -> elimina il file temporaneo
      await unlink(this.templateFilePath(tmpPath)).catch(() => undefined);
      throw error;
    }
  }

  async update(
    id: string,
    {
      section_id,
      name,
      description,
      content,
      fields,
      status,
    }: UpdateTemplateInput,
  ) {
    const existing = await this.findOneOrThrow(id);
    if (section_id !== undefined && section_id !== null) {
      assertUuid(section_id, "section_id");
      const sectionExists =
        await this.templatesRepository.sectionExists(section_id);
      if (!sectionExists) {
        throw makeError("section_id non esistente", 400);
      }
    }
    const nextContent = content ?? existing.content;
    this.assertValidContent(nextContent);
    const nextFields = normalizeFieldDefinitions(
      nextContent,
      fields ?? existing.fields,
    );
    const contentPath = existing.content_path ?? this.toStorageFilename(id);

    // Usa pattern tmp+rename atomica: scrivi su .tmp, commit DB, poi rename
    // Cosi se la transaction fallisce il file originale e intatto
    const tmpPath = `${contentPath}.tmp`;
    await mkdir(TEMPLATES_STORAGE_PATH, { recursive: true });
    await writeFile(this.templateFilePath(tmpPath), nextContent, "utf8");
    try {
      const updated = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.updateTemplate(manager, {
          id,
          sectionId:
            section_id === undefined
              ? existing.section_id
              : (section_id ?? null),
          name: name?.trim() || existing.name,
          description: description ?? existing.description,
          contentPath,
          fields: nextFields,
          status: status ?? existing.status,
        }),
      );
      // DB ok -> promuovi il file temporaneo
      await rename(
        this.templateFilePath(tmpPath),
        this.templateFilePath(contentPath),
      );
      return this.hydrateContent(updated);
    } catch (error) {
      // DB fallito o rename fallita -> elimina il file temporaneo, il file originale e ancora valido
      await unlink(this.templateFilePath(tmpPath)).catch(() => undefined);
      throw error;
    }
  }

  async importFromMarkdown(
    content: string,
    name: string,
    created_by = "system",
    section_id?: string,
  ) {
    return this.create({ section_id, name, content, created_by });
  }

  async delete(id: string) {
    const template = await this.findOneOrThrow(id);
    const activeDocuments =
      await this.templatesRepository.countActiveDocuments(id);
    if (activeDocuments > 0) {
      throw makeError(
        "Impossibile eliminare: esistono documenti attivi basati su questo template",
        409,
      );
    }
    await this.templatesRepository.deleteTemplate(id);
    await this.deleteTemplateContent(template.content_path);
    return { deleted: true };
  }

  getExportContent(template: { content: string }): string {
    return template.content;
  }

  validateMarkdown(content: string) {
    return validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
  }
}
