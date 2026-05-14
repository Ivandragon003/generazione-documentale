import { randomUUID } from "node:crypto";
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
import type { GitHubTemplateFile } from "./github-storage.service";
import { GitHubStorageService } from "./github-storage.service";

export interface CreateTemplateInput {
  name: string;
  content: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
  path?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  content?: string;
  fields?: PartialFieldDefinition[];
}

type TemplateWithContent = TemplateEntity & {
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
};

const MAX_TEMPLATE_CONTENT_BYTES = appConfig.maxTemplateContentBytes;

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(TemplatesRepository)
    private readonly templatesRepository: TemplatesRepository,
    @Inject(GitHubStorageService)
    private readonly githubStorage: GitHubStorageService,
  ) {}

  private assertValidContent(content: string): void {
    const result = validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
    if (!result.valid) throw makeError(result.errors.join("; "), 400);
  }

  private normalizeTemplateId(raw: string): string {
    return this.githubStorage.normalizeTemplateId(raw);
  }

  private contentPathCandidates(raw: string): string[] {
    return this.githubStorage.contentPathCandidates(raw);
  }

  private async findMetadataByGitHubId(
    raw: string,
  ): Promise<TemplateEntity | null> {
    return this.templatesRepository.findOneByContentPaths(
      this.contentPathCandidates(raw),
    );
  }

  private mapMetadataByGitHubId(rows: TemplateEntity[]) {
    const byPath = new Map<string, TemplateEntity>();
    for (const row of rows) {
      if (!row.content_path) continue;
      const key = this.normalizeTemplateId(row.content_path);
      const previous = byPath.get(key);
      if (!previous || row.updated_at > previous.updated_at) {
        byPath.set(key, row);
      }
    }
    return byPath;
  }

  private mergeGitHubTemplate(
    template: GitHubTemplateFile,
    metadata?: TemplateEntity,
  ): TemplateWithContent {
    return {
      id: metadata?.id ?? template.id,
      name: metadata?.name ?? template.name,
      content_path: metadata?.content_path ?? template.content_path,
      fields: metadata?.fields ?? template.fields,
      created_by: metadata?.created_by ?? template.created_by,
      created_at: metadata?.created_at ?? template.created_at,
      updated_at: metadata?.updated_at ?? template.updated_at,
      content: template.content,
      githubPath: template.githubPath,
      category: template.category,
      section: template.section,
    } as TemplateWithContent;
  }

  private async hydrateFromGitHub(
    row: TemplateEntity,
  ): Promise<TemplateWithContent> {
    if (!row.content_path) {
      throw makeError(
        "Legacy template without GitHub content_path: excluded from template source",
        404,
      );
    }

    const templateId = this.normalizeTemplateId(row.content_path);
    const githubTemplate = await this.githubStorage.getTemplate(templateId);
    if (!githubTemplate) {
      this.logger.warn(
        `DB template ${row.id} excluded: content_path ${row.content_path} does not exist on GitHub`,
      );
      throw makeError("Template not found on GitHub", 404);
    }

    this.logger.debug(
      `Template ${row.id} hydrated from GitHub (${githubTemplate.githubPath})`,
    );
    return this.mergeGitHubTemplate(githubTemplate, row);
  }

  private async findOneOrThrow(id: string): Promise<TemplateWithContent> {
    const template = await this.findOne(id);
    if (!template) throw makeError("Template not found", 404);
    return template;
  }

  async resolveTemplateIdForPdfJob(
    id: string,
    actor = "system",
    createIfGitHubVirtual = false,
  ): Promise<string | null> {
    if (!id.startsWith("github:")) {
      assertUuid(id);
      return id;
    }

    const normalized = this.normalizeTemplateId(id);
    const existing = await this.findMetadataByGitHubId(normalized);
    if (existing) return existing.id;
    if (!createIfGitHubVirtual) return null;

    const githubTemplate = await this.githubStorage.getTemplate(normalized);
    if (!githubTemplate) throw makeError("Template not found on GitHub", 404);

    const saved = await this.importGitHubTemplateToDb(githubTemplate, actor);
    return saved.id;
  }

  async findAll({
    limit = 20,
    offset = 0,
  }: {
    limit?: number;
    offset?: number;
  }) {
    const githubTemplates = await this.githubStorage.listTemplates();
    const metadataRows = await this.templatesRepository.findByContentPaths(
      githubTemplates.flatMap((template) =>
        this.contentPathCandidates(template.content_path),
      ),
    );
    const metadataByPath = this.mapMetadataByGitHubId(metadataRows);

    const merged = githubTemplates.map((template) =>
      this.mergeGitHubTemplate(
        template,
        metadataByPath.get(this.normalizeTemplateId(template.content_path)),
      ),
    );

    this.logger.log(
      `Template list served from GitHub: ${merged.length}/${githubTemplates.length} visible templates, ${metadataRows.length} DB records used only as metadata`,
    );

    return {
      data: merged.slice(offset, offset + limit),
      total: merged.length,
      limit,
      offset,
    };
  }

  async findOne(id: string): Promise<TemplateWithContent | null> {
    if (id.startsWith("github:")) {
      const normalized = this.normalizeTemplateId(id);
      const metadata = await this.findMetadataByGitHubId(normalized);
      const githubTemplate = await this.githubStorage.getTemplate(normalized);
      if (!githubTemplate) return null;

      this.logger.log(`Template ${normalized} served from GitHub`);
      return this.mergeGitHubTemplate(githubTemplate, metadata ?? undefined);
    }

    assertUuid(id);
    const row = await this.templatesRepository.findById(id);
    if (!row) return null;
    return this.hydrateFromGitHub(row);
  }

  async create({
    name,
    content,
    fields,
    created_by = "system",
    path,
  }: CreateTemplateInput) {
    if (!name || name.trim().length === 0) {
      throw makeError("Template name is required", 400);
    }

    if (content === undefined || content === null) {
      throw makeError(
        "The 'content' field is missing from request body. " +
          "Use PUT /api/templates/:id to update an existing template",
        400,
      );
    }

    this.assertValidContent(content);

    const id = randomUUID();
    const contentPath = this.normalizeTemplateId(path ?? id);
    const existingForPath =
      await this.templatesRepository.findByContentPath(contentPath);
    if (existingForPath) {
      throw makeError("Template content path already exists", 409);
    }
    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      content,
      fields,
    );

    await this.githubStorage.writeTemplate(contentPath, content);

    try {
      const dbRow = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.insertTemplate(manager, {
          id,
          name: name.trim(),
          contentPath,
          fields: normalizedFields,
          createdBy: created_by,
        }),
      );

      const path = this.githubStorage.filePath(contentPath);
      const meta = this.githubStorage.templateMetaFromPath(path);
      return this.mergeGitHubTemplate(
        {
          id: `github:${meta.templateId}`,
          name: meta.name,
          content_path: meta.templateId,
          githubPath: path,
          category: meta.category,
          section: meta.section,
          fields: dbRow.fields,
          created_by: dbRow.created_by,
          created_at: dbRow.created_at,
          updated_at: dbRow.updated_at,
          content,
        },
        dbRow,
      );
    } catch (error) {
      this.logger.error(
        `DB transaction failed for template ${id}, attempting GitHub rollback`,
      );
      await this.githubStorage
        .deleteTemplate(contentPath)
        .catch((deleteError) => {
          this.logger.error(
            `GitHub rollback failed for template ${contentPath}:`,
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError),
          );
        });
      throw error;
    }
  }

  async update(id: string, { name, content, fields }: UpdateTemplateInput) {
    const persistedId = id.startsWith("github:")
      ? await this.resolveTemplateIdForPdfJob(id, "system", true)
      : id;
    if (!persistedId) throw makeError("Template not found", 404);

    const existing = await this.findOneOrThrow(persistedId);
    const nextContent = content ?? existing.content;
    this.assertValidContent(nextContent);

    const nextFields = normalizeFieldDefinitions(
      nextContent,
      fields ?? existing.fields,
    );
    const templateId = this.normalizeTemplateId(
      existing.content_path ?? persistedId,
    );
    const existingForPath =
      await this.templatesRepository.findByContentPath(templateId);
    if (existingForPath && existingForPath.id !== persistedId) {
      throw makeError("Template content path already exists", 409);
    }

    await this.githubStorage.writeTemplate(templateId, nextContent);

    try {
      const dbRow = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.updateTemplate(manager, {
          id: persistedId,
          name: name?.trim() || existing.name,
          contentPath: templateId,
          fields: nextFields,
        }),
      );

      const path = this.githubStorage.filePath(templateId);
      const meta = this.githubStorage.templateMetaFromPath(path);
      return this.mergeGitHubTemplate(
        {
          id: `github:${meta.templateId}`,
          name: meta.name,
          content_path: meta.templateId,
          githubPath: path,
          category: meta.category,
          section: meta.section,
          fields: dbRow.fields,
          created_by: dbRow.created_by,
          created_at: dbRow.created_at,
          updated_at: dbRow.updated_at,
          content: nextContent,
        },
        dbRow,
      );
    } catch (error) {
      this.logger.error(
        `CRITICAL: GitHub updated but DB failed for template ${persistedId}. Manual verification required.`,
      );
      throw error;
    }
  }

  async importGitHubTemplateToDb(
    template: GitHubTemplateFile | TemplateWithContent,
    actor = "system",
  ): Promise<TemplateEntity> {
    const contentPath = this.normalizeTemplateId(
      (template as GitHubTemplateFile).githubPath ??
        template.content_path ??
        template.id,
    );

    const existing = await this.findMetadataByGitHubId(contentPath);
    if (existing) return existing;

    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      template.content,
      (template.fields as PartialFieldDefinition[]) ?? [],
    );

    const id = randomUUID();
    const saved = await this.dataSource.transaction(async (manager) =>
      this.templatesRepository.insertTemplate(manager, {
        id,
        name: template.name,
        contentPath,
        fields: normalizedFields,
        createdBy: actor,
      }),
    );

    this.logger.log(
      `Template GitHub "${template.name}" linked to DB with id ${id} (content_path: ${contentPath})`,
    );

    return saved;
  }

  async delete(id: string) {
    if (id.startsWith("github:")) {
      const contentPath = this.normalizeTemplateId(id);
      const metadata = await this.findMetadataByGitHubId(contentPath);
      if (metadata) {
        const activeDocuments =
          await this.templatesRepository.countActiveDocuments(metadata.id);
        if (activeDocuments > 0) {
          throw makeError(
            "Cannot delete: PDF jobs exist for this template",
            409,
          );
        }
        await this.templatesRepository.deleteTemplate(metadata.id);
      }
      await this.githubStorage.deleteTemplate(contentPath);
      return { deleted: true };
    }

    assertUuid(id);
    const template = await this.templatesRepository.findById(id);
    if (!template) throw makeError("Template not found", 404);

    const activeDocuments =
      await this.templatesRepository.countActiveDocuments(id);
    if (activeDocuments > 0) {
      throw makeError("Cannot delete: PDF jobs exist for this template", 409);
    }

    await this.templatesRepository.deleteTemplate(id);

    if (template.content_path) {
      const templateId = this.normalizeTemplateId(template.content_path);
      await this.githubStorage.deleteTemplate(templateId).catch((error) => {
        this.logger.error(
          `Unable to delete template ${id} from GitHub (DB already updated):`,
          error instanceof Error ? error.message : String(error),
        );
      });
    }

    return { deleted: true };
  }
}
