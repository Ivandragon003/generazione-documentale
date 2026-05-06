import { Injectable, Logger } from "@nestjs/common";
import { makeError } from "../common/utils/errors";
import { appConfig } from "../config/app.config";

const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";

export interface GithubFileInfo {
  sha: string;
  content: string;
  path: string;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  private get owner(): string {
    return appConfig.github.owner;
  }

  private get repo(): string {
    return appConfig.github.repo;
  }

  private get branch(): string {
    return appConfig.github.branch;
  }

  private get catalogPath(): string {
    return appConfig.github.catalogPath;
  }

  private get templatesDir(): string {
    return appConfig.github.templatesDir;
  }

  private get token(): string | undefined {
    return appConfig.github.token;
  }

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  private assertConfig(): void {
    if (!this.owner || !this.repo) {
      throw makeError(
        "Configurazione GitHub mancante: imposta GITHUB_TEMPLATES_OWNER e GITHUB_TEMPLATES_REPO nel .env",
        500,
      );
    }
  }

  /**
   * Scarica il CATALOG.json dal repo GitHub.
   */
  async fetchCatalog(): Promise<CatalogEntry[]> {
    this.assertConfig();
    const url = `${GITHUB_RAW}/${this.owner}/${this.repo}/${this.branch}/${this.catalogPath}`;
    this.logger.debug(`Fetching catalog from ${url}`);
    const response = await fetch(url, { headers: this.authHeaders() });
    if (!response.ok) {
      throw makeError(
        `GitHub catalog non raggiungibile: ${response.status} ${response.statusText}`,
        502,
      );
    }
    return response.json() as Promise<CatalogEntry[]>;
  }

  /**
   * Scarica il contenuto grezzo di un file .md dal repo GitHub.
   */
  async fetchTemplateContent(filename: string): Promise<string> {
    this.assertConfig();
    const url = `${GITHUB_RAW}/${this.owner}/${this.repo}/${this.branch}/${this.templatesDir}/${filename}`;
    this.logger.debug(`Fetching template content from ${url}`);
    const response = await fetch(url, { headers: this.authHeaders() });
    if (!response.ok) {
      throw makeError(
        `GitHub template non raggiungibile: ${response.status} ${response.statusText}`,
        502,
      );
    }
    return response.text();
  }

  /**
   * Legge le info (SHA) di un file esistente sul repo via API.
   * Ritorna null se il file non esiste.
   */
  async getFileInfo(filePath: string): Promise<GithubFileInfo | null> {
    this.assertConfig();
    const url = `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${filePath}?ref=${this.branch}`;
    const response = await fetch(url, { headers: this.authHeaders() });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw makeError(
        `GitHub API error: ${response.status} ${response.statusText}`,
        502,
      );
    }
    const data = (await response.json()) as {
      sha: string;
      content: string;
      path: string;
    };
    return {
      sha: data.sha,
      content: Buffer.from(data.content, "base64").toString("utf8"),
      path: data.path,
    };
  }

  /**
   * Crea o sovrascrive un file nel repo GitHub.
   * Se il file esiste già, usa il SHA per aggiornarla (PUT).
   */
  async pushFile(
    filePath: string,
    content: string,
    commitMessage: string,
  ): Promise<void> {
    this.assertConfig();
    if (!this.token) {
      throw makeError(
        "GITHUB_TOKEN non configurato: necessario per scrivere sul repo",
        500,
      );
    }
    const existing = await this.getFileInfo(filePath);
    const url = `${GITHUB_API}/repos/${this.owner}/${this.repo}/contents/${filePath}`;
    const body: Record<string, unknown> = {
      message: commitMessage,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: this.branch,
    };
    if (existing) body.sha = existing.sha;

    const response = await fetch(url, {
      method: "PUT",
      headers: { ...this.authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.text();
      throw makeError(`Errore push GitHub: ${response.status} — ${err}`, 502);
    }
    this.logger.log(
      `Pushed ${filePath} to GitHub (${existing ? "update" : "create"})`,
    );
  }

  /**
   * Push del CATALOG.json aggiornato.
   */
  async pushCatalog(catalog: CatalogEntry[]): Promise<void> {
    await this.pushFile(
      this.catalogPath,
      JSON.stringify(catalog, null, 2) + "\n",
      "chore: aggiorna CATALOG.json",
    );
  }

  /**
   * Push di un template .md.
   */
  async pushTemplateFile(
    filename: string,
    content: string,
    message: string,
  ): Promise<void> {
    const filePath = `${this.templatesDir}/${filename}`;
    await this.pushFile(filePath, content, message);
  }
}

export interface CatalogEntry {
  id: string;
  name: string;
  description?: string;
  file: string;
  fields: string[];
}
