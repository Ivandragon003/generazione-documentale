/**
 * github-storage.service.ts
 *
 * FIX: writeTemplate non cade mai sul fallback locale.
 * Se GitHub non è configurato → scrive localmente (modalità sviluppo senza token).
 * Se GitHub è configurato ma la PUT fallisce → propaga l'errore (502) senza
 * salvare una copia locale silenziosamente.
 * Questo garantisce che il frontend veda sempre l'errore reale invece di
 * pensare che il salvataggio sia riuscito.
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
  content?: string;
  download_url?: string;
  message?: string;
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
          "GitHubStorageService userà storage locale.",
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
    this.logger.log(
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

    // parts.length >= 3 → categoria/sezione/file.md
    // parts.length == 2 → sezione/file.md
    // parts.length == 1 → file.md (root della cartella templates)
    return {
      relativePath,
      name,
      category: parts.length >= 3 ? parts[0] : null,
      section:
        parts.length >= 3 ? parts[1] : parts.length === 2 ? parts[0] : null,
    };
  }

  // ── API pubblica ─────────────────────────────────────────────────────────

  /**
   * Legge il contenuto Markdown di un template.
   * Se GitHub è configurato → legge da GitHub, con fallback locale.
   * Se GitHub non è configurato → legge solo dallo storage locale.
   */
  async readTemplate(templateId: string): Promise<string | null> {
    if (!this.isConfigured()) {
      return this.readLocalTemplate(templateId);
    }

    const path = this.filePath(templateId);
    try {
      const meta = await this.getFileMeta(path);
      if (meta?.content !== undefined) return meta.content;
    } catch (error) {
      this.logger.error(
        `Impossibile leggere template ${templateId} da GitHub`,
        error instanceof Error ? error.stack : undefined,
      );
    }
    return this.readLocalTemplate(templateId);
  }

  async listTemplates(): Promise<GitHubTemplateFile[]> {
    if (!this.isConfigured()) return [];

    const files = await this.listMarkdownFiles(this.config.templatesDir);
    const now = new Date();

    // Esclude file di sistema nella root della cartella templates
    const EXCLUDED_NAMES = [".gitkeep", "CATALOG"];
    const filteredFiles = files.filter((file) => {
      const basename = file.name.replace(/\.md$/i, "");
      return !EXCLUDED_NAMES.includes(basename);
    });

    const templates = await Promise.all(
      filteredFiles.map(async (file) => {
        const meta = this.templateMetaFromPath(file.path);
        const fileContent = (await this.getFileMeta(file.path))?.content ?? "";
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
          content: fileContent,
        };
      }),
    );

    return templates;
  }

  /**
   * Scrive (crea o aggiorna) il contenuto Markdown di un template.
   *
   * COMPORTAMENTO:
   * - GitHub configurato → PUT su GitHub. Se fallisce → lancia errore 502
   *   (NON usa fallback locale: il chiamante deve vedere l'errore reale).
   * - GitHub NON configurato → scrive su storage locale (modalità dev).
   */
  async writeTemplate(templateId: string, content: string): Promise<void> {
    if (!this.isConfigured()) {
      // Modalità sviluppo senza GitHub: storage locale è l'unica destinazione
      await this.writeLocalTemplate(templateId, content);
      return;
    }

    const path = this.filePath(templateId);
    const url = this.contentUrl(path);

    // Recupera sha se il file esiste (necessario per aggiornamento)
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
      // FIX: non usare fallback locale se GitHub è configurato ma fallisce.
      // Propaghiamo l'errore così il frontend/service può gestirlo.
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
