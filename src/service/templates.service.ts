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
  status?: "draft" | "published";
  path?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  fields?: PartialFieldDefinition[];
  status?: "draft" | "published";
}

const MAX_TEMPLATE_CONTENT_BYTES = appConfig.maxTemplateContentBytes;

/**
 * Un template DB è "orfano locale" (seeded / legacy) se il suo content_path
 * è identico al suo UUID — significa che non è stato creato tramite l'app
 * con un path GitHub reale.
 */
function isOrphanLocalTemplate(template: TemplateEntity): boolean {
  if (!template.content_path) return true;
  const path = template.content_path.endsWith(".md")
    ? template.content_path.slice(0, -3)
    : template.content_path;
  // Un path GitHub reale contiene almeno uno slash (categoria/sezione/nome)
  // Un UUID non contiene slash
  return !path.includes("/");
}

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

  // ── Helpers privati ────────────────────────────────────────────────────────

  private assertValidContent(content: string): void {
    const result = validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
    if (!result.valid) throw makeError(result.errors.join("; "), 400);
  }

  private async findOneOrThrow(
    id: string,
  ): Promise<TemplateEntity & { content: string }> {
    assertUuid(id);
    const template = await this.findOne(id);
    if (!template) throw makeError("Template non trovato", 404);
    return template;
  }

  private normalizeTemplateId(raw: string): string {
    return raw.endsWith(".md") ? raw.slice(0, -3) : raw;
  }

  private async hydrateContent<
    T extends { content_path: string | null; id: string },
  >(row: T | null, strict = false): Promise<(T & { content: string }) | null> {
    if (!row) return null;

    const rawId = row.content_path ?? row.id;
    const templateId = this.normalizeTemplateId(rawId);

    const content = await this.githubStorage.readTemplate(templateId);

    if (content === null) {
      if (strict) {
        this.logger.error(
          `Contenuto template non trovato su GitHub per id: ${templateId}`,
        );
        throw makeError("Contenuto template non disponibile su GitHub", 503);
      }
      this.logger.warn(
        `Contenuto template mancante su GitHub per id: ${templateId} — restituisco stringa vuota`,
      );
      return { ...row, content: "" };
    }

    return { ...row, content };
  }

  private isGitHubConfigured(): boolean {
    return Boolean(
      process.env.GITHUB_TOKEN?.trim() &&
        process.env.GITHUB_OWNER?.trim() &&
        process.env.GITHUB_REPO?.trim(),
    );
  }

  // ── API pubblica ───────────────────────────────────────────────────────────

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

    const githubConfigured = this.isGitHubConfigured();

    // strict=false: template senza file GitHub vengono restituiti con content=""
    const hydratedData = await Promise.all(
      data.map((row) => this.hydrateContent(row, false)),
    );

    const githubTemplates = await this.githubStorage.listTemplates();

    // FIX: quando GitHub è configurato, escludiamo i template DB "orfani"
    // (quelli senza un path GitHub valido, es. template seeded con UUID come content_path).
    // Quando GitHub NON è configurato, mostriamo tutto (storage locale).
    const localTemplates = hydratedData.filter(
      (row): row is TemplateEntity & { content: string } => {
        if (!row) return false;
        if (!row.content?.trim()) return false;

        if (githubConfigured && isOrphanLocalTemplate(row as TemplateEntity)) {
          // Template seeded/legacy senza corrispondenza GitHub — escludi
          return false;
        }
        return true;
      },
    );

    const localPaths = new Set(
      localTemplates
        .map((t) => t.content_path)
        .filter((p): p is string => Boolean(p))
        .map((p) => this.normalizeTemplateId(p)),
    );

    // Includi solo i template GitHub che non hanno già una copia locale
    const uniqueGithubTemplates = githubTemplates.filter((gt) => {
      let githubNormalized = gt.id;
      if (githubNormalized.startsWith("github:")) {
        githubNormalized = githubNormalized.slice(7);
      }
      const githubId = this.normalizeTemplateId(githubNormalized);
      return !localPaths.has(githubId);
    });

    return {
      data: [...uniqueGithubTemplates, ...localTemplates],
      total: total + uniqueGithubTemplates.length,
      limit,
      offset,
    };
  }

  async findOne(
    id: string,
  ): Promise<(TemplateEntity & { content: string }) | null> {
    if (id.startsWith("github:")) {
      let normalized = id.slice(7);
      normalized = this.normalizeTemplateId(normalized);

      const row = await this.dataSource
        .getRepository("TemplateEntity")
        .findOne({ where: { content_path: normalized } });

      if (row) {
        return this.hydrateContent(row as TemplateEntity, true);
      }

      const githubTemplates = await this.githubStorage.listTemplates();
      const virtual = githubTemplates.find((t) => t.id === id);
      if (!virtual) return null;

      return virtual as unknown as TemplateEntity & { content: string };
    }

    assertUuid(id);
    const row = await this.templatesRepository.findById(id);
    return this.hydrateContent(row, true);
  }

  async create({
    name,
    description,
    content,
    fields,
    created_by = "system",
    status,
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
    let contentPath: string = id;

    if (path) {
      let normalized = path;
      if (normalized.startsWith("github:")) normalized = normalized.slice(7);
      contentPath = this.normalizeTemplateId(normalized);
    }

    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      content,
      fields,
    );

    await this.githubStorage.writeTemplate(contentPath, content);

    try {
      const template = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.insertTemplate(manager, {
          id,
          name: name.trim(),
          description,
          contentPath,
          fields: normalizedFields,
          createdBy: created_by,
          status,
        }),
      );

      return this.hydrateContent(template, true);
    } catch (error) {
      this.logger.error(
        `Transazione DB fallita per template ${id}, tentativo rollback GitHub`,
      );
      await this.githubStorage.deleteTemplate(id).catch((deleteError) => {
        this.logger.error(
          `Rollback GitHub fallito per template ${id}:`,
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
    { name, description, content, fields, status }: UpdateTemplateInput,
  ) {
    const existing = await this.findOneOrThrow(id);

    const nextContent = content ?? existing.content;
    this.assertValidContent(nextContent);

    const nextFields = normalizeFieldDefinitions(
      nextContent,
      fields ?? existing.fields,
    );

    const rawId = existing.content_path ?? id;
    const templateId = this.normalizeTemplateId(rawId);

    await this.githubStorage.writeTemplate(templateId, nextContent);

    try {
      const updated = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.updateTemplate(manager, {
          id,
          name: name?.trim() || existing.name,
          description: description ?? existing.description,
          contentPath: templateId,
          fields: nextFields,
          status: status ?? existing.status,
        }),
      );

      return this.hydrateContent(updated, true);
    } catch (error) {
      this.logger.error(
        `CRITICO: GitHub aggiornato ma DB fallito per template ${id}. ` +
          `Potrebbe esserci disallineamento. Verificare manualmente.`,
      );
      throw error;
    }
  }

  async importGitHubTemplateToDb(
    template: GitHubTemplateFile | (TemplateEntity & { content: string }),
    actor = "system",
  ): Promise<TemplateEntity> {
    const contentPath = this.normalizeTemplateId(
      (template as GitHubTemplateFile).githubPath ??
        template.content_path ??
        template.id,
    );

    const existing = await this.dataSource
      .getRepository("TemplateEntity")
      .findOne({ where: { content_path: contentPath } });

    if (existing) return existing as TemplateEntity;

    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      template.content ?? "",
      (template.fields as PartialFieldDefinition[]) ?? [],
    );

    const id = randomUUID();
    const saved = await this.dataSource.transaction(async (manager) =>
      this.templatesRepository.insertTemplate(manager, {
        id,
        name: template.name,
        description: (template as GitHubTemplateFile).description ?? undefined,
        contentPath,
        fields: normalizedFields,
        createdBy: actor,
        status: "published",
      }),
    );

    this.logger.log(
      `Template GitHub "${template.name}" importato nel DB con id ${id} (content_path: ${contentPath})`,
    );

    return saved;
  }

  async importFromMarkdown(
    content: string,
    name: string,
    created_by = "system",
  ) {
    return this.create({ name, content, created_by });
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

    const rawId = template.content_path ?? id;
    const templateId = this.normalizeTemplateId(rawId);
    await this.githubStorage.deleteTemplate(templateId).catch((error) => {
      this.logger.error(
        `Impossibile eliminare template ${id} da GitHub (DB già aggiornato):`,
        error instanceof Error ? error.message : String(error),
      );
    });

    return { deleted: true };
  }

  getExportContent(template: { content: string }): string {
    return template.content;
  }

  validateMarkdown(content: string) {
    return validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
  }
}
