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

import { Injectable, Logger } from "@nestjs/common";
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

@Injectable()
export class GitHubStorageService {
  private readonly logger = new Logger(GitHubStorageService.name);
  private readonly config: GitHubConfig;
  private readonly baseUrl = "https://api.github.com";

  constructor() {
    const token = process.env.GITHUB_TOKEN ?? "";
    const owner = process.env.GITHUB_OWNER ?? "";
    const repo = process.env.GITHUB_REPO ?? "";

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
      branch: process.env.GITHUB_BRANCH ?? "main",
      templatesDir: process.env.GITHUB_TEMPLATES_DIR ?? "templates",
    };
  }

  // ── Helpers interni ──────────────────────────────────────────────────────

  private filePath(templateId: string): string {
    return `${this.config.templatesDir}/${templateId}.md`;
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
    return `${this.baseUrl}/repos/${owner}/${repo}/contents/${path}`;
  }

  /**
   * Recupera sha e contenuto di un file esistente.
   * Ritorna null se il file non esiste (404).
   * Lancia per altri errori HTTP.
   */
  private async getFileMeta(
    path: string,
  ): Promise<{ sha: string; content: string } | null> {
    const url = `${this.contentUrl(path)}?ref=${this.config.branch}`;
    const response = await fetch(url, { headers: this.headers() });

    if (response.status === 404) return null;

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`GitHub GET ${path} → ${response.status}: ${body}`);
      throw makeError(`GitHub storage: impossibile leggere ${path}`, 502);
    }

    const data = (await response.json()) as GitHubContentResponse;
    // content è base64 con \n ogni 60 char — va pulito
    const raw = data.content ?? "";
    const decoded = Buffer.from(raw.replace(/\n/g, ""), "base64").toString(
      "utf8",
    );
    return { sha: data.sha, content: decoded };
  }

  // ── API pubblica ─────────────────────────────────────────────────────────

  /**
   * Legge il contenuto Markdown di un template da GitHub.
   * Ritorna null se il file non esiste.
   */
  async readTemplate(templateId: string): Promise<string | null> {
    this.assertConfigured();
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

  /**
   * Scrive (crea o aggiorna) il contenuto Markdown di un template su GitHub.
   * Usa PUT con sha se il file esiste già (aggiornamento atomico).
   */
  async writeTemplate(templateId: string, content: string): Promise<void> {
    this.assertConfigured();
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
        `GitHub storage: impossibile scrivere template ${templateId}`,
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
    this.assertConfigured();
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
        `GitHub storage: impossibile eliminare template ${templateId}`,
        502,
      );
    }

    this.logger.log(`Template ${templateId} eliminato da GitHub`);
  }

  /**
   * Verifica che le variabili d'ambiente necessarie siano configurate.
   * Lancia 503 se mancanti, così il frontend riceve un errore chiaro.
   */
  private assertConfigured(): void {
    if (!this.config.token || !this.config.owner || !this.config.repo) {
      throw makeError(
        "GitHub storage non configurato: impostare GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO",
        503,
      );
    }
  }
}
