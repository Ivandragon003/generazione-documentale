import { Inject, Injectable } from "@nestjs/common";
import { makeError } from "../common/utils/errors";
import { AuditLogsService } from "./audit-logs.service";
import type { TemplateVersionInfo } from "./github-storage.service";
import { GitHubStorageService } from "./github-storage.service";
import { TemplateStorageService } from "./template-storage.service";
import { TenantProvider } from "./tenant-provider.service";

@Injectable()
export class GitTemplateVersioningService {
  constructor(
    @Inject(GitHubStorageService)
    private readonly githubStorage: GitHubStorageService,
    @Inject(TemplateStorageService)
    private readonly localStorage: TemplateStorageService,
    @Inject(TenantProvider)
    private readonly tenantProvider: TenantProvider,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private async assertTenant(tenantUuid: string): Promise<void> {
    const tenant = await this.tenantProvider.getTenantByUuid(tenantUuid);
    if (!tenant) throw makeError("Tenant not found", 404);
  }

  async syncTenantTemplates(tenantUuid: string): Promise<void> {
    await this.assertTenant(tenantUuid);
    const templates =
      await this.githubStorage.listTemplatesByTenant(tenantUuid);
    await Promise.all(
      templates.map((template) =>
        this.localStorage.writeTemplate(
          tenantUuid,
          template.content_path,
          template.content,
        ),
      ),
    );
    await this.auditLogsService.recordSafe({
      tenantUuid,
      eventType: "template.sync.completed",
      payload: { count: templates.length },
    });
  }

  async listTemplateVersions(
    tenantUuid: string,
    templatePath: string,
  ): Promise<TemplateVersionInfo[]> {
    await this.assertTenant(tenantUuid);
    return this.githubStorage.listTemplateVersions(tenantUuid, templatePath);
  }

  async getTemplateVersionContent(
    tenantUuid: string,
    templatePath: string,
    commitSha: string,
  ): Promise<string> {
    await this.assertTenant(tenantUuid);
    if (!commitSha?.trim()) throw makeError("commitSha is required", 400);
    return this.githubStorage.getTemplateVersionContent(
      tenantUuid,
      templatePath,
      commitSha.trim(),
    );
  }

  async updateTemplate(
    tenantUuid: string,
    templatePath: string,
    content: string,
    commitMessage?: string,
  ): Promise<void> {
    await this.assertTenant(tenantUuid);
    await this.localStorage.writeTemplate(tenantUuid, templatePath, content);
    await this.githubStorage.writeTemplateForTenant(
      tenantUuid,
      templatePath,
      content,
      commitMessage,
    );
  }

  async restoreTemplateVersion(
    tenantUuid: string,
    templatePath: string,
    commitSha: string,
  ): Promise<{ restoredFrom: string }> {
    const content = await this.getTemplateVersionContent(
      tenantUuid,
      templatePath,
      commitSha,
    );
    await this.updateTemplate(
      tenantUuid,
      templatePath,
      content,
      `restore template ${templatePath} to version ${commitSha.slice(0, 7)}`,
    );
    await this.auditLogsService.recordSafe({
      tenantUuid,
      eventType: "template.version.restored",
      templateId: `github:${tenantUuid}/${templatePath}`,
      payload: { commitSha },
    });
    return { restoredFrom: commitSha };
  }
}
