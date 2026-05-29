import { promises as fs } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { makeError } from "../common/utils/errors";
import { sha256Signature } from "../common/utils/signature.utils";

// Tenant-scoped filesystem mirror used to support GitHub synchronization.
// GitHubStorageService remains the source of truth for template content.
@Injectable()
export class TemplateStorageService {
  private readonly logger = new Logger(TemplateStorageService.name);
  private readonly baseDir = resolve(
    process.env.TEMPLATES_STORAGE_PATH?.trim() || "templates-storage",
  );

  normalizeTemplatePath(raw: string): string {
    let normalized = raw.trim().replaceAll("\\", "/");
    if (normalized.startsWith("github:")) normalized = normalized.slice(7);
    while (normalized.startsWith("/")) normalized = normalized.slice(1);
    if (normalized.toLowerCase().endsWith(".md")) {
      normalized = normalized.slice(0, -3);
    }
    normalized = normalized.split("/").filter(Boolean).join("/");
    if (!normalized) throw makeError("template path is required", 400);
    return normalized;
  }

  resolveTenantPath(tenantUuid: string, templatePath: string): string {
    const normalizedPath = this.normalizeTemplatePath(templatePath);
    const fullPath = resolve(
      this.baseDir,
      tenantUuid,
      normalize(`${normalizedPath}.md`),
    );
    const tenantRoot = resolve(this.baseDir, tenantUuid);
    if (!fullPath.startsWith(tenantRoot)) {
      throw makeError("Invalid template path", 400);
    }
    return fullPath;
  }

  calculateContentChecksum(content: string): string {
    return sha256Signature(content);
  }

  private checksumPathForTemplatePath(fullPath: string): string {
    return `${fullPath}.sha256`;
  }

  private async invalidateResolvedTemplatePath(
    fullPath: string,
  ): Promise<void> {
    await fs.rm(fullPath, { force: true });
    await fs.rm(this.checksumPathForTemplatePath(fullPath), { force: true });
  }

  async writeTemplate(
    tenantUuid: string,
    templatePath: string,
    content: string,
  ): Promise<void> {
    const fullPath = this.resolveTenantPath(tenantUuid, templatePath);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, "utf8");
    await fs.writeFile(
      this.checksumPathForTemplatePath(fullPath),
      this.calculateContentChecksum(content),
      "utf8",
    );
  }

  async readTemplate(
    tenantUuid: string,
    templatePath: string,
  ): Promise<string | null> {
    const fullPath = this.resolveTenantPath(tenantUuid, templatePath);
    let content: string;
    try {
      content = await fs.readFile(fullPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }

    let expectedChecksum: string;
    try {
      expectedChecksum = await fs.readFile(
        this.checksumPathForTemplatePath(fullPath),
        "utf8",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.logger.warn(
          `Template cache not verifiable for ${tenantUuid}/${this.normalizeTemplatePath(templatePath)}: checksum metadata missing. Invalidating local mirror; re-sync from GitHub source of truth.`,
        );
        await this.invalidateResolvedTemplatePath(fullPath);
        return null;
      }
      throw error;
    }

    const actualChecksum = this.calculateContentChecksum(content);
    if (actualChecksum !== expectedChecksum.trim()) {
      this.logger.warn(
        `Template cache corrupted for ${tenantUuid}/${this.normalizeTemplatePath(templatePath)}: checksum mismatch. Invalidating local mirror; re-sync from GitHub source of truth.`,
      );
      await this.invalidateResolvedTemplatePath(fullPath);
      return null;
    }
    return content;
  }

  async deleteTemplate(
    tenantUuid: string,
    templatePath: string,
  ): Promise<void> {
    const fullPath = this.resolveTenantPath(tenantUuid, templatePath);
    await this.invalidateResolvedTemplatePath(fullPath);
  }

  getTenantRoot(tenantUuid: string): string {
    return join(this.baseDir, tenantUuid);
  }
}
