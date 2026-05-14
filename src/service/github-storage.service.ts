/**
 * GitHub storage for template Markdown content.
 *
 * GitHub is the single source of truth for templates: no local reads/writes,
 * no legacy seed and no silent fallback.
 */

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
  private listCache: {
    expiresAt: number;
    templates: GitHubTemplateFile[];
  } | null = null;

  constructor() {
    const token = process.env.GITHUB_TOKEN?.trim() ?? "";
    const owner = process.env.GITHUB_OWNER?.trim() ?? "";
    const repo = process.env.GITHUB_REPO?.trim() ?? "";

    if (!token || !owner || !repo) {
      this.logger.warn(
        "GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO are not configured. Templates require GitHub.",
      );
    }

    this.config = {
      token,
      owner,
      repo,
      branch: process.env.GITHUB_BRANCH?.trim() || "main",
      templatesDir: process.env.GITHUB_TEMPLATES_DIR?.trim() || "templates",
    };
  }

  normalizeTemplateId(raw: string): string {
    let normalized = raw.trim().replace(/\\/g, "/");
    if (normalized.startsWith("github:")) normalized = normalized.slice(7);
    while (normalized.startsWith("/")) normalized = normalized.slice(1);
    if (normalized.startsWith(`${this.config.templatesDir}/`)) {
      normalized = normalized.slice(this.config.templatesDir.length + 1);
    }
    if (normalized.toLowerCase().endsWith(".md")) {
      normalized = normalized.slice(0, -3);
    }
    return normalized;
  }

  contentPathCandidates(raw: string): string[] {
    const id = this.normalizeTemplateId(raw);
    return [
      ...new Set([id, `${id}.md`, `${this.config.templatesDir}/${id}.md`]),
    ];
  }

  filePath(templateId: string): string {
    return `${this.config.templatesDir}/${this.normalizeTemplateId(templateId)}.md`;
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

  private assertConfigured(operation: string): void {
    if (!this.isConfigured()) {
      throw makeError(
        `GitHub storage is not configured: cannot ${operation} template`,
        503,
      );
    }
  }

  private gitHubFailureMessage(
    operation: "read" | "write" | "delete",
    path: string,
    status: number,
    body: string,
  ): string {
    if (status === 404) {
      return (
        `GitHub storage: cannot ${operation} ${path}. ` +
        `Repository, branch, directory o permessi non validi per ` +
        `${this.config.owner}/${this.config.repo}@${this.config.branch}. ` +
        "Verifica GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH e i permessi contents."
      );
    }
    return `GitHub storage: cannot ${operation} ${path}: ${body}`;
  }

  private async getFileMeta(
    path: string,
  ): Promise<{ sha: string; content: string } | null> {
    const url = `${this.contentUrl(path)}?ref=${encodeURIComponent(this.config.branch)}`;
    const response = await fetch(url, { headers: this.headers() });

    if (response.status === 404) return null;

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`GitHub GET ${path} -> ${response.status}: ${body}`);
      throw makeError(
        this.gitHubFailureMessage("read", path, response.status, body),
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
      if (response.status === 404) {
        this.logger.warn(
          `GitHub templates: directory ${path} non trovata in ${this.config.owner}/${this.config.repo}@${this.config.branch}`,
        );
        return [];
      }
      throw makeError(
        this.gitHubFailureMessage("read", path, response.status, body),
        502,
      );
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

  templateMetaFromPath(path: string) {
    const relativePath = path.startsWith(`${this.config.templatesDir}/`)
      ? path.slice(this.config.templatesDir.length + 1)
      : path;
    const parts = relativePath.split("/");
    const filename = parts.at(-1) ?? relativePath;
    const name = filename.replace(/\.md$/i, "");
    const templateId = this.normalizeTemplateId(relativePath);

    return {
      relativePath,
      templateId,
      name,
      category: parts.length >= 3 ? parts[0] : null,
      section: parts.length >= 3 ? parts[1] : null,
    };
  }

  async readTemplate(templateId: string): Promise<string | null> {
    this.assertConfigured("read");

    const normalized = this.normalizeTemplateId(templateId);
    const path = this.filePath(normalized);
    const meta = await this.getFileMeta(path);
    if (!meta) {
      this.logger.warn(`Template ${normalized} missing on GitHub (${path})`);
      return null;
    }
    this.logger.debug(`Template ${normalized} read from GitHub (${path})`);
    return meta.content;
  }

  async getTemplate(templateId: string): Promise<GitHubTemplateFile | null> {
    const normalized = this.normalizeTemplateId(templateId);
    const content = await this.readTemplate(normalized);
    if (content === null) return null;

    const path = this.filePath(normalized);
    const meta = this.templateMetaFromPath(path);
    const now = new Date();
    return {
      id: `github:${meta.templateId}`,
      name: meta.name,
      content_path: meta.templateId,
      githubPath: path,
      category: meta.category,
      section: meta.section,
      fields: [],
      created_by: "github",
      created_at: now,
      updated_at: now,
      content,
    };
  }

  async listTemplates(): Promise<GitHubTemplateFile[]> {
    this.assertConfigured("elencare");

    const nowMs = Date.now();
    if (this.listCache && this.listCache.expiresAt > nowMs) {
      return this.listCache.templates;
    }

    const files = await this.listMarkdownFiles(this.config.templatesDir);
    const now = new Date();
    const maybeTemplates = await Promise.all<GitHubTemplateFile | null>(
      files.map(async (file) => {
        const fileMeta = await this.getFileMeta(file.path);
        if (!fileMeta?.content?.trim()) {
          this.logger.warn(
            `Template GitHub excluded due to empty or unreadable content: ${file.path}`,
          );
          return null;
        }

        const meta = this.templateMetaFromPath(file.path);
        return {
          id: `github:${meta.templateId}`,
          name: meta.name,
          content_path: meta.templateId,
          githubPath: file.path,
          category: meta.category,
          section: meta.section,
          fields: [] as FieldDefinition[],
          created_by: "github",
          created_at: now,
          updated_at: now,
          content: fileMeta.content,
        };
      }),
    );

    const templates = maybeTemplates.filter(
      (template): template is GitHubTemplateFile => template !== null,
    );
    this.listCache = { expiresAt: nowMs + 30_000, templates };
    this.logger.log(
      `Templates loaded from GitHub: ${templates.length} file da ${this.config.owner}/${this.config.repo}@${this.config.branch}/${this.config.templatesDir}`,
    );
    return templates;
  }

  async writeTemplate(templateId: string, content: string): Promise<void> {
    this.assertConfigured("salvare");

    const normalized = this.normalizeTemplateId(templateId);
    const path = this.filePath(normalized);
    const url = this.contentUrl(path);
    const existing = await this.getFileMeta(path);

    const body: Record<string, unknown> = {
      message: existing
        ? `chore: update template ${normalized}`
        : `chore: add template ${normalized}`,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: this.config.branch,
    };

    if (existing?.sha) body.sha = existing.sha;

    const response = await fetch(url, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      this.logger.error(
        `GitHub PUT ${path} -> ${response.status}: ${responseBody}`,
      );
      throw makeError(
        this.gitHubFailureMessage("write", path, response.status, responseBody),
        502,
      );
    }

    this.listCache = null;
    this.logger.log(
      `Template ${normalized} ${existing ? "updated" : "created"} on GitHub (${this.config.owner}/${this.config.repo}/${path})`,
    );
  }

  async deleteTemplate(templateId: string): Promise<void> {
    this.assertConfigured("delete");

    const normalized = this.normalizeTemplateId(templateId);
    const path = this.filePath(normalized);
    const existing = await this.getFileMeta(path);
    if (!existing) {
      this.logger.warn(
        `Template ${normalized} not found on GitHub, skipping delete`,
      );
      return;
    }

    const response = await fetch(this.contentUrl(path), {
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify({
        message: `chore: delete template ${normalized}`,
        sha: existing.sha,
        branch: this.config.branch,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      this.logger.error(
        `GitHub DELETE ${path} -> ${response.status}: ${responseBody}`,
      );
      throw makeError(
        this.gitHubFailureMessage(
          "delete",
          path,
          response.status,
          responseBody,
        ),
        502,
      );
    }

    this.listCache = null;
    this.logger.log(`Template ${normalized} deleted from GitHub`);
  }

  private isConfigured(): boolean {
    return Boolean(this.config.token && this.config.owner && this.config.repo);
  }
}
