import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
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
import type { GithubService, CatalogEntry } from "./github.service";

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

const MAX_TEMPLATE_CONTENT_BYTES = Math.max(
  Number.parseInt(process.env.MAX_TEMPLATE_CONTENT_BYTES ?? "200000", 10),
  1000,
);

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly templatesRepository: TemplatesRepository,
    private readonly githubService: GithubService,
  ) {}

  // ─── Validazione ─────────────────────────────────────────────────────────

  private assertValidContent(content: string): void {
    const result = validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
    if (!result.valid) throw makeError(result.errors.join("; "), 400);
  }

  // ─── GitHub: path del file .md nel repo ──────────────────────────────────

  /** Ritorna il nome del file nel repo GitHub: {id}/v{version}.md */
  private githubFilename(templateId: string, version: number): string {
    return `${templateId}/v${version}.md`;
  }

  // ─── GitHub: lettura contenuto ───────────────────────────────────────────

  /**
   * Legge il contenuto di un template dal repo GitHub.
   * content_path contiene il nome del file relativo alla cartella templates-catalog/
   */
  private async readTemplateContent(contentPath: string | null): Promise<string | null> {
    if (!contentPath) return null;
    try {
      return await this.githubService.fetchTemplateContent(contentPath);
    } catch (err) {
      this.logger.error(`Impossibile leggere template da GitHub: ${contentPath}`, err);
      return null;
    }
  }

  private async hydrateContent<T extends { content_path: string | null }>(
    row: T | null,
  ): Promise<(T & { content: string }) | null> {
    if (!row) return null;
    const content = await this.readTemplateContent(row.content_path);
    if (!content) throw makeError("Contenuto template non disponibile su GitHub", 500);
    return { ...row, content };
  }

  // ─── GitHub: scrittura contenuto ─────────────────────────────────────────

  private async writeTemplateToGithub(
    templateId: string,
    version: number,
    content: string,
    action: "create" | "update",
  ): Promise<string> {
    const filename = this.githubFilename(templateId, version);
    const message =
      action === "create"
        ? `feat: aggiungi template ${templateId} v${version}`
        : `chore: aggiorna template ${templateId} a v${version}`;
    await this.githubService.pushTemplateFile(filename, content, message);
    return filename;
  }

  // ─── Find ─────────────────────────────────────────────────────────────────

  private async findOneOrThrow(id: string): Promise<TemplateEntity & { content: string }> {
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
    const { data, total } = await this.templatesRepository.findAll({ status, limit, offset });
    const hydratedData = await Promise.all(data.map((row) => this.hydrateContent(row)));
    return {
      data: hydratedData.filter(
        (row): row is TemplateEntity & { content: string } => Boolean(row),
      ),
      total,
      limit,
      offset,
    };
  }

  async findOne(id: string): Promise<(TemplateEntity & { content: string }) | null> {
    assertUuid(id);
    const row = await this.templatesRepository.findById(id);
    return this.hydrateContent(row);
  }

  // ─── GitHub Catalog ───────────────────────────────────────────────────────

  /**
   * Restituisce la lista dei template disponibili nel CATALOG.json di GitHub.
   * Endpoint utile per esplorare i template sorgente prima dell'import.
   */
  async listCatalog(): Promise<CatalogEntry[]> {
    return this.githubService.fetchCatalog();
  }

  // ─── Create ──────────────────────────────────────────────────────────────

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
    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(content, fields);
    const contentPath = await this.writeTemplateToGithub(id, 1, content, "create");
    const template = await this.dataSource.transaction(async (manager) => {
      const created = await this.templatesRepository.insertTemplate(manager, {
        id,
        name: name.trim(),
        description,
        contentPath,
        fields: normalizedFields,
        createdBy: created_by,
      });
      await this.templatesRepository.insertTemplateVersion(manager, {
        templateId: created.id,
        version: 1,
        contentPath,
        fields: normalizedFields,
        status: "draft",
        action: "create",
        createdBy: created_by,
      });
      return created;
    });
    return this.hydrateContent(template);
  }

  // ─── Update ──────────────────────────────────────────────────────────────

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
    // Sovrascrive su GitHub (push della nuova versione)
    const contentPath = await this.writeTemplateToGithub(id, nextVersion, nextContent, "update");
    const updated = await this.dataSource.transaction(async (manager) => {
      const row = await this.templatesRepository.updateTemplate(manager, {
        id,
        name: name?.trim() || existing.name,
        description: description ?? existing.description,
        contentPath,
        fields: nextFields,
        newVersion: nextVersion,
      });
      await this.templatesRepository.insertTemplateVersion(manager, {
        templateId: id,
        version: nextVersion,
        contentPath,
        fields: nextFields,
        status: existing.status,
        action: "update",
        createdBy: created_by,
      });
      return row;
    });
    return this.hydrateContent(updated);
  }

  // ─── Import da .md ───────────────────────────────────────────────────────

  /**
   * Importa un template da un file .md caricato via upload.
   * Dopo la creazione, il file viene pushato su GitHub.
   */
  async importFromMarkdown(content: string, name: string, created_by = "system") {
    return this.create({ name, content, created_by });
  }

  /**
   * Importa un template direttamente dal CATALOG.json di GitHub.
   * Scarica il .md e lo registra nel DB.
   */
  async importFromCatalog(catalogId: string, created_by = "system") {
    const catalog = await this.githubService.fetchCatalog();
    const entry = catalog.find((e) => e.id === catalogId);
    if (!entry) throw makeError(`Template "${catalogId}" non trovato nel CATALOG.json`, 404);
    const content = await this.githubService.fetchTemplateContent(entry.file);
    return this.create({
      name: entry.name,
      description: entry.description,
      content,
      created_by,
    });
  }

  // ─── Restore ─────────────────────────────────────────────────────────────

  async restore(id: string, targetVersion: number, actor = "system") {
    const existing = await this.findOneOrThrow(id);
    const versionRow = await this.templatesRepository.findVersionById(id, targetVersion);
    if (!versionRow) throw makeError(`Versione ${targetVersion} non trovata`, 404);
    const oldContent = await this.readTemplateContent(versionRow.content_path);
    if (!oldContent) throw makeError("Contenuto versione non disponibile su GitHub", 404);
    const nextVersion = existing.version + 1;
    const nextFields = normalizeFieldDefinitions(oldContent, versionRow.fields);
    const contentPath = await this.writeTemplateToGithub(id, nextVersion, oldContent, "update");
    const restored = await this.dataSource.transaction(async (manager) => {
      const row = await this.templatesRepository.restoreTemplate(
        manager, id, contentPath, nextFields, nextVersion,
      );
      await this.templatesRepository.insertTemplateVersion(manager, {
        templateId: id,
        version: nextVersion,
        contentPath,
        fields: nextFields,
        status: "draft",
        action: `restore_from_v${targetVersion}`,
        createdBy: actor,
      });
      return row;
    });
    return this.hydrateContent(restored);
  }

  // ─── Versions ────────────────────────────────────────────────────────────

  async getVersions(id: string) {
    await this.findOneOrThrow(id);
    return this.templatesRepository.findVersions(id);
  }

  async getVersionContent(id: string, version: number) {
    await this.findOneOrThrow(id);
    const row = await this.templatesRepository.findVersionById(id, version);
    return this.hydrateContent(row);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  async delete(id: string) {
    const existing = await this.findOneOrThrow(id);
    const activeDocuments = await this.templatesRepository.countActiveDocuments(id);
    if (activeDocuments > 0) {
      throw makeError(
        "Impossibile eliminare: esistono documenti attivi basati su questo template",
        409,
      );
    }
    await this.templatesRepository.deleteTemplate(id);
    // Nota: i file su GitHub rimangono (storico), solo il DB record viene eliminato
    return { deleted: true };
  }

  // ─── Utils ───────────────────────────────────────────────────────────────

  getExportContent(template: { content: string }): string {
    return template.content;
  }

  validateMarkdown(content: string) {
    return validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
  }
}
