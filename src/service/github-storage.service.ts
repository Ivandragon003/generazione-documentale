/**
 * github-storage.service.ts
 *
 * Servizio di storage per i contenuti Markdown dei template su GitHub.
 * Sostituisce il file system locale (writeFile/readFile) usato da TemplatesService.
 *
 * Variabili d'ambiente richieste:
 *   GITHUB_TOKEN         Personal Access Token con scope "repo" (o "contents:write" per fine-grained)
 *   GITHUB_OWNER         Owner del repository (utente o organizzazione)
 *   GITHUB_REPO          Nome del repository
 *   GITHUB_BRANCH        Branch di destinazione (default: main)
 *   GITHUB_TEMPLATES_DIR Directory nel repo (default: templates)
 *
 * Ogni template viene salvato come:
 *   {GITHUB_TEMPLATES_DIR}/{templateId}.md
 *
 * L'API GitHub usata è la REST Content API:
 *   PUT  /repos/{owner}/{repo}/contents/{path}   → crea o aggiorna
 *   GET  /repos/{owner}/{repo}/contents/{path}   → legge
 *   DELETE /repos/{owner}/{repo}/contents/{path} → elimina
 *
 * Il campo "sha" è obbligatorio per aggiornare o eliminare un file esistente.
 * Viene recuperato automaticamente prima di ogni write/delete.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { makeError } from "../common/utils/errors";

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  templatesDir: string;
}

interface GitHubContentResponse {
  sha: string;
  content?: string; // base64, presente solo in GET singolo file
  download_url?: string;
  message?: string; // presente in caso di errore
}

interface GitHubDirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface GitHubTemplateFile {
  id: string;
  name: string;
  content_path: string;
  githubPath: string;
  category: string | null;
  section: string | null;
  status: "draft" | "published";
  description: string | null;
  fields: FieldDefinition[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  content: string;
}

@Injectable()
export class GitHubStorageService {
  private readonly logger = new Logger(GitHubStorageService.name);
  private readonly config: GitHubConfig;
  private readonly baseUrl = "https://api.github.com";
  private readonly localTemplatesDir: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN?.trim() ?? "";
    const owner = process.env.GITHUB_OWNER?.trim() ?? "";
    const repo = process.env.GITHUB_REPO?.trim() ?? "";

    if (!token || !owner || !repo) {
      this.logger.warn(
        "GITHUB_TOKEN, GITHUB_OWNER o GITHUB_REPO non configurati. " +
          "GitHubStorageService non sarà operativo.",
      );
    }

    this.config = {
      token,
      owner,
      repo,
      branch: process.env.GITHUB_BRANCH?.trim() || "main",
      templatesDir: process.env.GITHUB_TEMPLATES_DIR?.trim() || "templates",
    };
    this.localTemplatesDir = resolve(
      process.env.TEMPLATES_STORAGE_PATH?.trim() || "./storage/templates",
    );
  }

  // ── Helpers interni ──────────────────────────────────────────────────────

  private filePath(templateId: string): string {
    return `${this.config.templatesDir}/${templateId}.md`;
  }

  private localFilePath(templateId: string): string {
    const relativePath = `${templateId}.md`;
    const target = resolve(this.localTemplatesDir, relativePath);

    // Protezione da path traversal: il target deve essere sottocartella di localTemplatesDir
    const normalizedDir = this.localTemplatesDir.endsWith("/")
      ? this.localTemplatesDir
      : `${this.localTemplatesDir}/`;
    const normalizedTarget = target.replace(/\\/g, "/");

    if (!normalizedTarget.startsWith(normalizedDir.replace(/\\/g, "/"))) {
      throw makeError("Percorso template locale non valido", 400);
    }
    return target;
  }

  private async readLocalTemplate(templateId: string): Promise<string | null> {
    try {
      return await readFile(this.localFilePath(templateId), "utf8");
    } catch {
      return null;
    }
  }

  private async writeLocalTemplate(
    templateId: string,
    content: string,
  ): Promise<void> {
    const target = this.localFilePath(templateId);
    const parentDir = resolve(target, "..");

    await mkdir(parentDir, { recursive: true });
    await writeFile(target, content, "utf8");
    this.logger.warn(
      `Template ${templateId} salvato nello storage locale (${target})`,
    );
  }

  private async deleteLocalTemplate(templateId: string): Promise<void> {
    await rm(this.localFilePath(templateId), { force: true });
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  private contentUrl(path: string): string {
    const { owner, repo } = this.config;
    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.baseUrl}/repos/${owner}/${repo}/contents/${encodedPath}`;
  }

  private gitHubFailureMessage(
    operation: "leggere" | "scrivere" | "eliminare",
    path: string,
    status: number,
    body: string,
  ): string {
    if (status === 404) {
      return (
        `GitHub storage: impossibile ${operation} ${path}. ` +
        `Repository, branch o permessi non validi per ` +
        `${this.config.owner}/${this.config.repo}@${this.config.branch}. ` +
        "Verifica GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH e permesso contents:write."
      );
    }
    return `GitHub storage: impossibile ${operation} ${path}: ${body}`;
  }

  /**
   * Recupera sha e contenuto di un file esistente.
   * Ritorna null se il file non esiste (404).
   * Lancia per altri errori HTTP.
   */
  private async getFileMeta(
    path: string,
  ): Promise<{ sha: string; content: string } | null> {
    const url = `${this.contentUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, { headers: this.headers() });

    if (response.status === 404) return null;

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`GitHub GET ${path} → ${response.status}: ${body}`);
      throw makeError(
        this.gitHubFailureMessage("leggere", path, response.status, body),
        502,
      );
    }

    const data = (await response.json()) as GitHubContentResponse;
    // content è base64 con \n ogni 60 char — va pulito
    const raw = data.content ?? "";
    const decoded = Buffer.from(raw.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );
    return { sha: data.sha, content: decoded };
  }

  private async listDirectory(path: string): Promise<GitHubDirectoryEntry[]> {
    const url = `${this.contentUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, { headers: this.headers() });

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(
        this.gitHubFailureMessage("leggere", path, response.status, body),
      );
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];
    return data.filter(
      (entry): entry is GitHubDirectoryEntry =>
        typeof entry?.name === "string" &&
        typeof entry?.path === "string" &&
        (entry?.type === "file" || entry?.type === "dir"),
    );
  }

  private async listMarkdownFiles(
    path: string,
  ): Promise<GitHubDirectoryEntry[]> {
    const entries = await this.listDirectory(path);
    const files = await Promise.all(
      entries.map(async (entry) => {
        if (entry.type === "dir") return this.listMarkdownFiles(entry.path);
        if (entry.name.toLowerCase().endsWith(".md")) return [entry];
        return [];
      }),
    );
    return files.flat();
  }

  private templateMetaFromPath(path: string) {
    const relativePath = path.startsWith(`${this.config.templatesDir}/`)
      ? path.slice(this.config.templatesDir.length + 1)
      : path;
    const parts = relativePath.split("/");
    const filename = parts.at(-1) ?? relativePath;
    const name = filename.replace(/\.md$/i, "");

    return {
      relativePath,
      name,
      category: parts.length >= 3 ? parts[0] : null,
      section: parts.length >= 3 ? parts[1] : null,
    };
  }

  // ── API pubblica ─────────────────────────────────────────────────────────

  /**
   * Legge il contenuto Markdown di un template da GitHub.
   * Ritorna null se il file non esiste.
   * Se GitHub è configurato, NON effettua fallback locale.
   */
  async readTemplate(templateId: string): Promise<string | null> {
    if (!this.isConfigured()) {
      return this.readLocalTemplate(templateId);
    }

    const path = this.filePath(templateId);
    try {
      const meta = await this.getFileMeta(path);
      return meta?.content ?? null;
    } catch (error) {
      this.logger.error(
        `Impossibile leggere template ${templateId} da GitHub`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }
  }

  async listTemplates(): Promise<GitHubTemplateFile[]> {
    if (!this.isConfigured()) return [];

    const files = await this.listMarkdownFiles(this.config.templatesDir);
    const now = new Date();
    const templates = await Promise.all(
      files
        .filter((file) => file.path.split("/").length >= 4)
        .map(async (file) => {
          const meta = this.templateMetaFromPath(file.path);
          const content = (await this.getFileMeta(file.path))?.content ?? "";
          return {
            id: `github:${meta.relativePath}`,
            name: meta.name,
            content_path: file.path,
            githubPath: file.path,
            category: meta.category,
            section: meta.section,
            status: "published" as const,
            description: null,
            fields: [],
            created_by: "github",
            created_at: now,
            updated_at: now,
            content,
          };
        }),
    );

    return templates;
  }

  /**
   * Scrive (crea o aggiorna) il contenuto Markdown di un template su GitHub.
   * Usa PUT con sha se il file esiste già (aggiornamento atomico).
   * Se GitHub è configurato e fallisce, lancia errore (no fallback locale).
   */
  async writeTemplate(templateId: string, content: string): Promise<void> {
    if (!this.isConfigured()) {
      await this.writeLocalTemplate(templateId, content);
      return;
    }
    const path = this.filePath(templateId);
    const url = this.contentUrl(path);

    // Recupera sha se il file esiste (necessario per update)
    const existing = await this.getFileMeta(path);

    const body: Record<string, unknown> = {
      message: existing
        ? `chore: update template ${templateId}`
        : `chore: add template ${templateId}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: this.config.branch,
    };

    if (existing?.sha) {
      body.sha = existing.sha;
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      this.logger.error(
        `GitHub PUT ${path} → ${response.status}: ${responseBody}`,
      );
      throw makeError(
        this.gitHubFailureMessage(
          "scrivere",
          path,
          response.status,
          responseBody,
        ),
        502,
      );
    }

    this.logger.log(
      `Template ${templateId} ${existing ? "aggiornato" : "creato"} su GitHub (${this.config.owner}/${this.config.repo}/${path})`,
    );
  }

  /**
   * Elimina il file Markdown di un template da GitHub.
   * Non lancia se il file non esiste (idempotente).
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await this.deleteLocalTemplate(templateId);
    if (!this.isConfigured()) return;

    const path = this.filePath(templateId);

    const existing = await this.getFileMeta(path);
    if (!existing) {
      this.logger.warn(
        `Template ${templateId} non trovato su GitHub, skip delete`,
      );
      return;
    }

    const url = this.contentUrl(path);
    const body = {
      message: `chore: delete template ${templateId}`,
      sha: existing.sha,
      branch: this.config.branch,
    };

    const response = await fetch(url, {
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      this.logger.error(
        `GitHub DELETE ${path} → ${response.status}: ${responseBody}`,
      );
      throw makeError(
        this.gitHubFailureMessage(
          "eliminare",
          path,
          response.status,
          responseBody,
        ),
        502,
      );
    }

    this.logger.log(`Template ${templateId} eliminato da GitHub`);
  }

  private isConfigured(): boolean {
    return Boolean(this.config.token && this.config.owner && this.config.repo);
  }
}
