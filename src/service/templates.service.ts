import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Injectable } from "@nestjs/common";
import type { DataSource } from "typeorm";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { makeError } from "../common/utils/errors";
import { assertUuid } from "../common/utils/http.utils";
import {
  normalizeFieldDefinitions,
  type PartialFieldDefinition,
  validateMarkdownContent,
} from "../common/utils/markdown.utils";
import type { TemplateEntity } from "../entities/template.entity";
import type { TemplateVersionEntity } from "../entities/template-version.entity";
import type { TemplatesRepository } from "../repository/templates.repository";

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
}

const TEMPLATE_STORAGE_PATH =
  process.env.TEMPLATE_STORAGE_PATH ?? "./storage/templates";
const MAX_TEMPLATE_CONTENT_BYTES = Math.max(
  Number.parseInt(process.env.MAX_TEMPLATE_CONTENT_BYTES ?? "200000", 10),
  1000,
);

@Injectable()
export class TemplatesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly templatesRepository: TemplatesRepository,
  ) {}

  private assertValidContent(content: string): void {
    const result = validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
    if (!result.valid) {
      throw makeError(result.errors.join("; "), 400);
    }
  }

  private getTemplateRelativePath(templateId: string, version: number): string {
    return join(templateId, `v${version}.md`).replace(/\\/g, "/");
  }

  private async writeTemplateFile(
    templateId: string,
    version: number,
    content: string,
  ): Promise<string> {
    const dir = join(TEMPLATE_STORAGE_PATH, templateId);
    await mkdir(dir, { recursive: true });
    const relativePath = this.getTemplateRelativePath(templateId, version);
    await writeFile(join(TEMPLATE_STORAGE_PATH, relativePath), content, "utf8");
    return relativePath;
  }

  private async readTemplateFile(
    contentPath: string | null,
  ): Promise<string | null> {
    if (!contentPath) return null;
    return readFile(join(TEMPLATE_STORAGE_PATH, contentPath), "utf8");
  }

  private async hydrateContent<T extends { content_path: string | null }>(
    row: T | null,
  ): Promise<(T & { content: string }) | null> {
    if (!row) return null;
    const content = await this.readTemplateFile(row.content_path);
    if (!content) throw makeError("Contenuto template non disponibile", 500);
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
    limit = 20,
    offset = 0,
  }: {
    status?: "draft" | "published";
    limit?: number;
    offset?: number;
  }) {
    const { data, total } = await this.templatesRepository.findAll({
      status,
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
    name,
    description,
    content,
    fields,
    created_by = "system",
  }: CreateTemplateInput) {
    if (!name || name.trim().length === 0) {
      throw makeError("Il nome del template e obbligatorio", 400);
    }
    this.assertValidContent(content);
    const id = randomUUID();
    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      content,
      fields,
    );
    const contentPath = await this.writeTemplateFile(id, 1, content);
    const template = await this.dataSource.transaction(async (manager) => {
      const createdTemplate = await this.templatesRepository.insertTemplate(
        manager,
        { id, name: name.trim(), description, contentPath, fields: normalizedFields, createdBy: created_by },
      );
      await this.templatesRepository.insertTemplateVersion(manager, {
        templateId: createdTemplate.id,
        version: 1,
        contentPath,
        fields: normalizedFields,
        status: "draft",
        action: "create",
        createdBy: created_by,
      });
      return createdTemplate;
    });
    return this.hydrateContent(template);
  }

  async update(
    id: string,
    { name, description, content, fields, created_by = "system" }: UpdateTemplateInput,
  ) {
    const existing = await this.findOneOrThrow(id);
    if (existing.status === "published") {
      throw makeError(
        "Un template pubblicato non puo essere modificato. Crea una nuova versione.",
        409,
      );
    }
    const nextContent = content ?? existing.content;
    this.assertValidContent(nextContent);
    const nextFields = normalizeFieldDefinitions(nextContent, fields ?? existing.fields);
    const nextVersion = existing.version + 1;
    const nextContentPath = await this.writeTemplateFile(id, nextVersion, nextContent);
    const updated = await this.dataSource.transaction(async (manager) => {
      const row = await this.templatesRepository.updateTemplate(manager, {
        id,
        name: name?.trim() || existing.name,
        description: description ?? existing.description,
        contentPath: nextContentPath,
        fields: nextFields,
        newVersion: nextVersion,
      });
      await this.templatesRepository.insertTemplateVersion(manager, {
        templateId: id,
        version: nextVersion,
        contentPath: nextContentPath,
        fields: nextFields,
        status: existing.status,
        action: "update",
        createdBy: created_by,
      });
      return row;
    });
    return this.hydrateContent(updated);
  }

  async restore(id: string, targetVersion: number, actor = "system") {
    const existing = await this.findOneOrThrow(id);
    const versionRow = await this.templatesRepository.findVersionById(id, targetVersion);
    if (!versionRow) throw makeError(`Versione ${targetVersion} non trovata`, 404);
    const oldVersion = await this.hydrateContent(
      versionRow as TemplateVersionEntity & { content_path: string | null },
    );
    if (!oldVersion) throw makeError("Versione template non disponibile", 404);
    const nextVersion = existing.version + 1;
    const nextFields = normalizeFieldDefinitions(oldVersion.content, oldVersion.fields);
    const nextContentPath = await this.writeTemplateFile(id, nextVersion, oldVersion.content);
    const restored = await this.dataSource.transaction(async (manager) => {
      const row = await this.templatesRepository.restoreTemplate(
        manager, id, nextContentPath, nextFields, nextVersion,
      );
      await this.templatesRepository.insertTemplateVersion(manager, {
        templateId: id,
        version: nextVersion,
        contentPath: nextContentPath,
        fields: nextFields,
        status: "draft",
        action: `restore_from_v${targetVersion}`,
        createdBy: actor,
      });
      return row;
    });
    return this.hydrateContent(restored);
  }

  async getVersions(id: string) {
    await this.findOneOrThrow(id);
    return this.templatesRepository.findVersions(id);
  }

  async getVersionContent(id: string, version: number) {
    await this.findOneOrThrow(id);
    const row = await this.templatesRepository.findVersionById(id, version);
    return this.hydrateContent(row);
  }

  async delete(id: string, actor = "system") {
    const existing = await this.findOneOrThrow(id);
    const activeDocuments = await this.templatesRepository.countActiveDocuments(id);
    if (activeDocuments > 0) {
      throw makeError(
        "Impossibile eliminare: esistono documenti attivi basati su questo template",
        409,
      );
    }
    await this.templatesRepository.deleteTemplate(id);
    await rm(join(TEMPLATE_STORAGE_PATH, id), { recursive: true, force: true });
    return { deleted: true };
  }

  getExportContent(template: { content: string }): string {
    return template.content;
  }

  async importFromMarkdown(content: string, name: string, created_by = "system") {
    return this.create({ name, content, created_by });
  }

  validateMarkdown(content: string) {
    return validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
  }
}
