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
  description?: string;
  content: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
  path?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
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
      description: metadata?.description ?? template.description,
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
        "Template legacy senza content_path GitHub: escluso dalla sorgente template",
        404,
      );
    }

    const templateId = this.normalizeTemplateId(row.content_path);
    const githubTemplate = await this.githubStorage.getTemplate(templateId);
    if (!githubTemplate) {
      this.logger.warn(
        `Template DB ${row.id} escluso: content_path ${row.content_path} non esiste su GitHub`,
      );
      throw makeError("Template non trovato su GitHub", 404);
    }

    this.logger.debug(
      `Template ${row.id} idratato da GitHub (${githubTemplate.githubPath})`,
    );
    return this.mergeGitHubTemplate(githubTemplate, row);
  }

  private async findOneOrThrow(id: string): Promise<TemplateWithContent> {
    const template = await this.findOne(id);
    if (!template) throw makeError("Template non trovato", 404);
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
    if (!githubTemplate) throw makeError("Template non trovato su GitHub", 404);

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
      `Lista template servita da GitHub: ${merged.length}/${githubTemplates.length} template visibili, ${metadataRows.length} record DB usati solo come metadata`,
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

      this.logger.log(`Template ${normalized} servito da GitHub`);
      return this.mergeGitHubTemplate(githubTemplate, metadata ?? undefined);
    }

    assertUuid(id);
    const row = await this.templatesRepository.findById(id);
    if (!row) return null;
    return this.hydrateFromGitHub(row);
  }

  async create({
    name,
    description,
    content,
    fields,
    created_by = "system",
    path,
  }: CreateTemplateInput) {
    if (!name || name.trim().length === 0) {
      throw makeError("Il nome del template e obbligatorio", 400);
    }

    if (content === undefined || content === null) {
      throw makeError(
        "Il campo 'content' manca nel body della richiesta. " +
          "Per aggiornare un template esistente usa PUT /api/templates/:id",
        400,
      );
    }

    this.assertValidContent(content);

    const id = randomUUID();
    const contentPath = this.normalizeTemplateId(path ?? id);
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
          description,
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
          description: dbRow.description,
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
        `Transazione DB fallita per template ${id}, tentativo rollback GitHub`,
      );
      await this.githubStorage
        .deleteTemplate(contentPath)
        .catch((deleteError) => {
          this.logger.error(
            `Rollback GitHub fallito per template ${contentPath}:`,
            deleteError instanceof Error
              ? deleteError.message
              : String(deleteError),
          );
        });
      throw error;
    }
  }

  async update(
    id: string,
    { name, description, content, fields }: UpdateTemplateInput,
  ) {
    const persistedId = id.startsWith("github:")
      ? await this.resolveTemplateIdForPdfJob(id, "system", true)
      : id;
    if (!persistedId) throw makeError("Template non trovato", 404);

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

    await this.githubStorage.writeTemplate(templateId, nextContent);

    try {
      const dbRow = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.updateTemplate(manager, {
          id: persistedId,
          name: name?.trim() || existing.name,
          description: description ?? existing.description,
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
          description: dbRow.description,
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
        `CRITICO: GitHub aggiornato ma DB fallito per template ${persistedId}. Verificare manualmente.`,
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
        description: template.description ?? undefined,
        contentPath,
        fields: normalizedFields,
        createdBy: actor,
      }),
    );

    this.logger.log(
      `Template GitHub "${template.name}" collegato al DB con id ${id} (content_path: ${contentPath})`,
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
            "Impossibile eliminare: esistono job PDF basati su questo template",
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
    if (!template) throw makeError("Template non trovato", 404);

    const activeDocuments =
      await this.templatesRepository.countActiveDocuments(id);
    if (activeDocuments > 0) {
      throw makeError(
        "Impossibile eliminare: esistono job PDF basati su questo template",
        409,
      );
    }

    await this.templatesRepository.deleteTemplate(id);

    if (template.content_path) {
      const templateId = this.normalizeTemplateId(template.content_path);
      await this.githubStorage.deleteTemplate(templateId).catch((error) => {
        this.logger.error(
          `Impossibile eliminare template ${id} da GitHub (DB gia aggiornato):`,
          error instanceof Error ? error.message : String(error),
        );
      });
    }

    return { deleted: true };
  }

  validateMarkdown(content: string) {
    return validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
  }
}
