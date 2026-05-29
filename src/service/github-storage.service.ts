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
interface GitHubCommitAuthor {
  name?: string;
  email?: string;
  date?: string;
}
interface GitHubCommitListItem {
  sha: string;
  commit?: {
    message?: string;
    author?: GitHubCommitAuthor;
    committer?: GitHubCommitAuthor;
  };
}

interface GitHubDirectoryEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

export interface TemplateTreeFolderNode {
  type: "folder";
  name: string;
  path: string;
}

export interface TemplateTreeFileNode {
  type: "template";
  name: string;
  path: string;
  id: string;
}

export interface TemplateTreeLevelResult {
  path: string;
  folders: TemplateTreeFolderNode[];
  templates: TemplateTreeFileNode[];
  nextCursor: string | null;
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

export interface TemplateVersionInfo {
  sha: string;
  shortSha: string;
  message: string;
  author: string | null;
  committedAt: string | null;
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
  private readonly tenantListCache = new Map<
    string,
    { expiresAt: number; templates: GitHubTemplateFile[] }
  >();
  private readonly defaultTenantUuid =
    process.env.DEFAULT_TENANT_UUID?.trim() ||
    "11111111-1111-1111-1111-111111111111";

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
      templatesDir: process.env.GITHUB_TEMPLATES_DIR?.trim() || "",
    };
  }

  normalizeTemplateId(raw: string): string {
    let normalized = raw.trim().replaceAll("\\", "/");
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

  normalizeTenantTemplatePath(raw: string): string {
    const normalized = this.normalizeTemplateId(raw);
    const [firstSegment, ...rest] = normalized.split("/");
    if (
      rest.length > 0 &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        firstSegment,
      )
    ) {
      return rest.join("/");
    }
    return normalized;
  }

  filePath(templateId: string): string {
    return `${this.config.templatesDir}/${this.normalizeTemplateId(templateId)}.md`;
  }

  filePathForTenant(tenantUuid: string, templatePath: string): string {
    const normalized = this.normalizeTenantTemplatePath(templatePath);
    const prefix = this.config.templatesDir
      ? `${this.config.templatesDir}/`
      : "";
    return `${prefix}${tenantUuid}/${normalized}.md`;
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
        `Invalid repository, branch, directory, or permissions for ` +
        `${this.config.owner}/${this.config.repo}@${this.config.branch}. ` +
        "Check GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, and contents permissions."
      );
    }
    return `GitHub storage: cannot ${operation} ${path}: ${body}`;
  }

  private async getFileMeta(
    path: string,
    ref = this.config.branch,
  ): Promise<{ sha: string; content: string } | null> {
    const url = `${this.contentUrl(path)}?ref=${encodeURIComponent(ref)}`;
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
    const decoded = Buffer.from(raw.replaceAll("\n", ""), "base64").toString(
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
          `GitHub templates: directory ${path} not found in ${this.config.owner}/${this.config.repo}@${this.config.branch}`,
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

  async listTenantTreeLevel(
    tenantUuid: string,
    currentPath = "",
    cursor = 0,
    limit = 50,
  ): Promise<TemplateTreeLevelResult> {
    this.assertConfigured("list");
    const normalizedPath = this.normalizeTenantTemplatePath(currentPath || "");
    const rootPrefix = this.config.templatesDir
      ? `${this.config.templatesDir}/`
      : "";
    const root = normalizedPath
      ? `${rootPrefix}${tenantUuid}/${normalizedPath}`
      : `${rootPrefix}${tenantUuid}`;
    const entries = await this.listDirectory(root);
    const folders = entries
      .filter((entry) => entry.type === "dir")
      .map((entry) => ({
        type: "folder" as const,
        name: entry.name,
        path: this.templateMetaFromTenantPath(
          tenantUuid,
          `${entry.path}/x.md`,
        ).templateId.replace(/\/x$/, ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const templates = entries
      .filter(
        (entry) =>
          entry.type === "file" && entry.name.toLowerCase().endsWith(".md"),
      )
      .map((entry) => {
        const meta = this.templateMetaFromTenantPath(tenantUuid, entry.path);
        return {
          type: "template" as const,
          name: meta.name,
          path: meta.templateId,
          id: `github:${tenantUuid}/${meta.templateId}`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const combined = [...folders, ...templates];
    const page = combined.slice(cursor, cursor + limit);
    const pagedFolders = page.filter(
      (item): item is TemplateTreeFolderNode => item.type === "folder",
    );
    const pagedTemplates = page.filter(
      (item): item is TemplateTreeFileNode => item.type === "template",
    );
    return {
      path: normalizedPath,
      folders: pagedFolders,
      templates: pagedTemplates,
      nextCursor:
        cursor + limit < combined.length ? String(cursor + limit) : null,
    };
  }

  async searchTenantTemplates(
    tenantUuid: string,
    query: string,
    currentPath = "",
    cursor = 0,
    limit = 50,
  ): Promise<{ items: TemplateTreeFileNode[]; nextCursor: string | null }> {
    this.assertConfigured("list");
    const normalizedPath = this.normalizeTenantTemplatePath(currentPath || "");
    const rootPrefix = this.config.templatesDir
      ? `${this.config.templatesDir}/`
      : "";
    const root = normalizedPath
      ? `${rootPrefix}${tenantUuid}/${normalizedPath}`
      : `${rootPrefix}${tenantUuid}`;
    const files = await this.listMarkdownFiles(root);
    const normalizedQuery = query.trim().toLowerCase();
    const matches = files
      .filter((file) => {
        const nameMatch = file.name.toLowerCase().includes(normalizedQuery);
        if (nameMatch) return true;
        const meta = this.templateMetaFromTenantPath(tenantUuid, file.path);
        return meta.templateId.toLowerCase().includes(normalizedQuery);
      })
      .map((file) => {
        const meta = this.templateMetaFromTenantPath(tenantUuid, file.path);
        return {
          type: "template" as const,
          name: meta.name,
          path: meta.templateId,
          id: `github:${tenantUuid}/${meta.templateId}`,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    const page = matches.slice(cursor, cursor + limit);
    return {
      items: page,
      nextCursor:
        cursor + limit < matches.length ? String(cursor + limit) : null,
    };
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
      category: parts.length >= 2 ? parts[0] : null,
      section: parts.length >= 3 ? parts[1] : null,
    };
  }

  templateMetaFromTenantPath(tenantUuid: string, path: string) {
    const prefix = this.config.templatesDir
      ? `${this.config.templatesDir}/${tenantUuid}/`
      : `${tenantUuid}/`;
    const relativePath = path.startsWith(prefix)
      ? path.slice(prefix.length)
      : path;
    const parts = relativePath.split("/");
    const filename = parts.at(-1) ?? relativePath;
    const name = filename.replace(/\.md$/i, "");
    const templateId = this.normalizeTenantTemplatePath(relativePath);

    return {
      relativePath,
      templateId,
      name,
      category: parts.length >= 2 ? parts[0] : null,
      section: parts.length >= 3 ? parts[1] : null,
      tenantUuid,
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
    this.assertConfigured("list");

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
      `Templates loaded from GitHub: ${templates.length} files from ${this.config.owner}/${this.config.repo}@${this.config.branch}/${this.config.templatesDir}`,
    );
    return templates;
  }

  async listTemplatesByTenant(
    tenantUuid: string,
  ): Promise<GitHubTemplateFile[]> {
    this.assertConfigured("list");
    const nowMs = Date.now();
    const cached = this.tenantListCache.get(tenantUuid);
    if (cached && cached.expiresAt > nowMs) {
      return cached.templates;
    }
    const root = this.config.templatesDir
      ? `${this.config.templatesDir}/${tenantUuid}`
      : tenantUuid;
    const files = await this.listMarkdownFiles(root);
    const now = new Date();
    const maybeTemplates = await Promise.all<GitHubTemplateFile | null>(
      files.map(async (file) => {
        const fileMeta = await this.getFileMeta(file.path);
        if (!fileMeta?.content?.trim()) return null;
        const meta = this.templateMetaFromTenantPath(tenantUuid, file.path);
        return {
          id: `github:${tenantUuid}/${meta.templateId}`,
          name: meta.name,
          content_path: meta.templateId,
          githubPath: file.path,
          category: meta.category,
          section: meta.section,
          fields: [],
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
    this.tenantListCache.set(tenantUuid, {
      expiresAt: nowMs + 30_000,
      templates,
    });
    return templates;
  }

  async getTemplateForTenant(
    tenantUuid: string,
    templatePath: string,
  ): Promise<GitHubTemplateFile | null> {
    const normalized = this.normalizeTenantTemplatePath(templatePath);
    const path = this.filePathForTenant(tenantUuid, normalized);
    const meta = await this.getFileMeta(path);
    if (!meta) return null;
    const fileMeta = this.templateMetaFromTenantPath(tenantUuid, path);
    const now = new Date();
    return {
      id: `github:${tenantUuid}/${fileMeta.templateId}`,
      name: fileMeta.name,
      content_path: fileMeta.templateId,
      githubPath: path,
      category: fileMeta.category,
      section: fileMeta.section,
      fields: [],
      created_by: "github",
      created_at: now,
      updated_at: now,
      content: meta.content,
    };
  }

  async writeTemplateForTenant(
    tenantUuid: string,
    templatePath: string,
    content: string,
    commitMessage?: string,
  ): Promise<void> {
    const normalized = this.normalizeTenantTemplatePath(templatePath);
    const path = this.filePathForTenant(tenantUuid, normalized);
    const url = this.contentUrl(path);
    const existing = await this.getFileMeta(path);

    const body: Record<string, unknown> = {
      message:
        commitMessage ||
        (existing
          ? `chore: update template ${tenantUuid}/${normalized}`
          : `chore: add template ${tenantUuid}/${normalized}`),
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
      throw makeError(
        this.gitHubFailureMessage("write", path, response.status, responseBody),
        502,
      );
    }
    this.listCache = null;
    this.tenantListCache.delete(tenantUuid);
  }

  async deleteTemplateForTenant(
    tenantUuid: string,
    templatePath: string,
  ): Promise<void> {
    const normalized = this.normalizeTenantTemplatePath(templatePath);
    const path = this.filePathForTenant(tenantUuid, normalized);
    const existing = await this.getFileMeta(path);
    if (!existing) return;
    const response = await fetch(this.contentUrl(path), {
      method: "DELETE",
      headers: this.headers(),
      body: JSON.stringify({
        message: `chore: delete template ${tenantUuid}/${normalized}`,
        sha: existing.sha,
        branch: this.config.branch,
      }),
    });
    if (!response.ok) {
      const responseBody = await response.text();
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
    this.tenantListCache.delete(tenantUuid);
  }

  async listTemplateVersions(
    tenantUuid: string,
    templatePath: string,
  ): Promise<TemplateVersionInfo[]> {
    this.assertConfigured("list");
    const normalized = this.normalizeTenantTemplatePath(templatePath);
    const path = this.filePathForTenant(tenantUuid, normalized);
    const { owner, repo } = this.config;
    const url =
      `${this.baseUrl}/repos/${owner}/${repo}/commits` +
      `?sha=${encodeURIComponent(this.config.branch)}` +
      `&path=${encodeURIComponent(path)}`;
    const response = await fetch(url, { headers: this.headers() });
    if (!response.ok) {
      const body = await response.text();
      throw makeError(
        `GitHub storage: cannot read versions for ${path}: ${body}`,
        502,
      );
    }
    const data = (await response.json()) as GitHubCommitListItem[];
    return (Array.isArray(data) ? data : []).map((entry) => {
      const message = entry.commit?.message?.trim() || "No message";
      const author =
        entry.commit?.author?.name || entry.commit?.committer?.name;
      const committedAt =
        entry.commit?.author?.date || entry.commit?.committer?.date || null;
      return {
        sha: entry.sha,
        shortSha: entry.sha.slice(0, 7),
        message,
        author: author ?? null,
        committedAt,
      };
    });
  }

  async getTemplateVersionContent(
    tenantUuid: string,
    templatePath: string,
    commitSha: string,
  ): Promise<string> {
    const normalized = this.normalizeTenantTemplatePath(templatePath);
    const path = this.filePathForTenant(tenantUuid, normalized);
    const meta = await this.getFileMeta(path, commitSha);
    if (!meta) throw makeError("Template version not found", 404);
    return meta.content;
  }

  async writeTemplate(templateId: string, content: string): Promise<void> {
    await this.writeTemplateForTenant(
      this.defaultTenantUuid,
      templateId,
      content,
    );
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.deleteTemplateForTenant(this.defaultTenantUuid, templateId);
  }

  private isConfigured(): boolean {
    return Boolean(this.config.token && this.config.owner && this.config.repo);
  }
}
