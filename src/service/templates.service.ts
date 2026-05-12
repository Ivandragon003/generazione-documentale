/**
 * templates.service.ts
 *
 * Modifiche rispetto alla versione originale:
 * - Rimosso: writeFile, readFile, rename, mkdir, unlink da node:fs/promises
 * - Aggiunto: GitHubStorageService per read/write/delete dei file .md
 * - content_path ora contiene solo il templateId (non un percorso su disco)
 *   Il GitHubStorageService calcola internamente il path GitHub.
 * - Rimosso il pattern tmp+rename (non necessario con GitHub che gestisce
 *   la consistenza lato suo con il campo sha).
 * - La logica di business (validazione, normalizzazione campi, versioning)
 *   rimane invariata.
 * - FIX: hydrateContent non lancia più 503 se il file non esiste su GitHub
 *   (fallback graceful a stringa vuota + warn, così findAll non crasha).
 * - FIX: content_path con estensione .md viene strippato prima dell'uso.
 */

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
import { GitHubStorageService } from "./github-storage.service";

export interface CreateTemplateInput {
  name: string;
  description?: string;
  content: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
  status?: "draft" | "published";
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  content?: string;
  fields?: PartialFieldDefinition[];
  status?: "draft" | "published";
}

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

  // ── Helpers privati ──────────────────────────────────────────────────────

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

  /**
   * Normalizza il templateId rimuovendo l'eventuale estensione .md
   * (alcuni record legacy in DB hanno content_path = "uuid.md").
   */
  private normalizeTemplateId(raw: string): string {
    return raw.endsWith(".md") ? raw.slice(0, -3) : raw;
  }

  /**
   * Idrata il campo virtuale `content` leggendo da GitHub.
   * content_path contiene il templateId (usato come chiave su GitHub).
   *
   * FIX: se il file non esiste su GitHub (template legacy / seed / migrazione)
   * NON lancia più 503 — restituisce content vuoto con un WARN,
   * così findAll non crasha e la lista rimane visibile.
   * Solo findOne (GET singolo) deve essere strict → parametro `strict`.
   */
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

  // ── API pubblica ─────────────────────────────────────────────────────────

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

    // strict=false: template senza file GitHub vengono restituiti con content=""
    const hydratedData = await Promise.all(
      data.map((row) => this.hydrateContent(row, false)),
    );
    const githubTemplates = await this.githubStorage.listTemplates();
    const localTemplates = hydratedData.filter(
      (row): row is TemplateEntity & { content: string } => Boolean(row),
    );

    return {
      data: [...githubTemplates, ...localTemplates],
      total: total + githubTemplates.length,
      limit,
      offset,
    };
  }

  async findOne(
    id: string,
  ): Promise<(TemplateEntity & { content: string }) | null> {
    assertUuid(id);
    const row = await this.templatesRepository.findById(id);
    // strict=true: GET singolo deve segnalare se il content manca
    return this.hydrateContent(row, true);
  }

  async create({
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

    this.assertValidContent(content);

    const id = randomUUID();
    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      content,
      fields,
    );

    // Fase 1: scrivi il file su GitHub PRIMA della transazione DB.
    // Se GitHub fallisce, non tocchiamo il DB.
    await this.githubStorage.writeTemplate(id, content);

    try {
      // Fase 2: salva i metadati nel DB.
      // content_path contiene il templateId (UUID puro, senza .md).
      const template = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.insertTemplate(manager, {
          id,
          name: name.trim(),
          description,
          contentPath: id,
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

    // Fase 1: aggiorna il file su GitHub
    await this.githubStorage.writeTemplate(templateId, nextContent);

    try {
      const updated = await this.dataSource.transaction(async (manager) =>
        this.templatesRepository.updateTemplate(manager, {
          id,
          name: name?.trim() || existing.name,
          description: description ?? existing.description,
          contentPath: templateId, // salva UUID puro, senza .md
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
