import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { makeError } from "../common/utils/errors";
import {
  normalizeFieldDefinitions,
  type PartialFieldDefinition,
  validateMarkdownContent,
} from "../common/utils/markdown.utils";
import { appConfig } from "../config/app.config";
import { AuditLogsService } from "./audit-logs.service";
import { GitTemplateVersioningService } from "./git-template-versioning.service";
import type {
  GitHubTemplateFile,
  TemplateTreeLevelResult,
} from "./github-storage.service";
import { GitHubStorageService } from "./github-storage.service";
import { TemplateFieldListsService } from "./template-field-lists.service";
import { TenantProvider } from "./tenant-provider.service";

export interface CreateTemplateInput {
  tenantUuid: string;
  name: string;
  content: string;
  fields?: PartialFieldDefinition[];
  created_by?: string;
  path?: string;
}

export interface UpdateTemplateInput {
  tenantUuid: string;
  name?: string;
  content?: string;
  fields?: PartialFieldDefinition[];
}

type TemplateWithContent = {
  id: string;
  name: string;
  content_path: string | null;
  fields: FieldDefinition[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  content: string;
  githubPath?: string;
  category?: string | null;
  section?: string | null;
};

const MAX_TEMPLATE_CONTENT_BYTES = appConfig.maxTemplateContentBytes;

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    @Inject(GitHubStorageService)
    private readonly githubStorage: GitHubStorageService,
    @Inject(GitTemplateVersioningService)
    private readonly versioningService: GitTemplateVersioningService,
    @Inject(TenantProvider)
    private readonly tenantProvider: TenantProvider,
    @Inject(TemplateFieldListsService)
    private readonly templateFieldListsService: TemplateFieldListsService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
  ) {}

  private async hydrateListFieldsForTenant(
    tenantUuid: string,
    fields: FieldDefinition[],
  ): Promise<FieldDefinition[]> {
    const hydrated: FieldDefinition[] = [];
    for (const field of fields) {
      if (field.type !== "list" || !field.listName) {
        hydrated.push(field);
        continue;
      }
      try {
        const values =
          await this.templateFieldListsService.getListValuesForTenant(
            tenantUuid,
            field.listName,
          );
        hydrated.push({
          ...field,
          options: values.map((value) => ({ label: value, value })),
        });
      } catch {
        hydrated.push(field);
      }
    }
    return hydrated;
  }

  private async assertTenantExists(tenantUuid: string): Promise<void> {
    const tenant = await this.tenantProvider.getTenantByUuid(tenantUuid);
    if (!tenant) throw makeError("Tenant not found", 404);
  }

  private assertValidContent(content: string): void {
    const result = validateMarkdownContent(content, MAX_TEMPLATE_CONTENT_BYTES);
    if (!result.valid) throw makeError(result.errors.join("; "), 400);
  }

  private mergeGitHubTemplate(
    template: GitHubTemplateFile,
  ): TemplateWithContent {
    return {
      id: template.id,
      name: template.name,
      content_path: template.content_path,
      fields: template.fields,
      created_by: template.created_by,
      created_at: template.created_at,
      updated_at: template.updated_at,
      content: template.content,
      githubPath: template.githubPath,
      category: template.category,
      section: template.section,
    };
  }

  private splitScopedTemplateId(id: string): {
    tenantUuid: string;
    templatePath: string;
  } {
    const normalized = this.githubStorage.normalizeTemplateId(id);
    const [tenantUuid, ...rest] = normalized.split("/");
    if (rest.length === 0) {
      return {
        tenantUuid: "11111111-1111-1111-1111-111111111111",
        templatePath: tenantUuid,
      };
    }
    return { tenantUuid, templatePath: rest.join("/") };
  }

  private async findOneOrThrow(
    tenantUuid: string,
    id: string,
  ): Promise<TemplateWithContent> {
    const template = await this.findOne(tenantUuid, id);
    if (!template) throw makeError("Template not found", 404);
    return template;
  }

  async resolveTemplateIdForPdfJob(
    id: string,
    createIfGitHubVirtual = false,
  ): Promise<string | null> {
    const [maybeTenant, ...pathParts] = this.githubStorage
      .normalizeTemplateId(id)
      .split("/");
    const tenantUuid =
      pathParts.length > 0
        ? maybeTenant
        : "11111111-1111-1111-1111-111111111111";
    const templatePath =
      pathParts.length > 0 ? pathParts.join("/") : maybeTenant;
    const githubTemplate = await this.githubStorage.getTemplateForTenant(
      tenantUuid,
      templatePath,
    );
    if (!githubTemplate && !createIfGitHubVirtual) return null;
    if (!githubTemplate) throw makeError("Template not found on GitHub", 404);
    return `github:${tenantUuid}/${templatePath}`;
  }

  async findAll({
    tenantUuid,
    limit = 20,
    offset = 0,
  }: {
    tenantUuid: string;
    limit?: number;
    offset?: number;
  }) {
    await this.assertTenantExists(tenantUuid);
    await this.versioningService.syncTenantTemplates(tenantUuid);
    const githubTemplates =
      await this.githubStorage.listTemplatesByTenant(tenantUuid);
    const merged = githubTemplates.map((template) =>
      this.mergeGitHubTemplate(template),
    );

    this.logger.log(
      `Template list served from GitHub: ${merged.length}/${githubTemplates.length} visible templates`,
    );

    return {
      data: merged.slice(offset, offset + limit),
      total: merged.length,
      limit,
      offset,
    };
  }

  async findOne(
    tenantUuidOrScopedId: string,
    maybeId?: string,
  ): Promise<TemplateWithContent | null> {
    const tenantUuid = maybeId
      ? tenantUuidOrScopedId
      : this.splitScopedTemplateId(tenantUuidOrScopedId).tenantUuid;
    const id =
      maybeId ?? this.splitScopedTemplateId(tenantUuidOrScopedId).templatePath;
    await this.assertTenantExists(tenantUuid);
    const normalized = this.githubStorage.normalizeTenantTemplatePath(id);
    const githubTemplate = await this.githubStorage.getTemplateForTenant(
      tenantUuid,
      normalized,
    );
    if (!githubTemplate) return null;
    this.logger.log(`Template ${normalized} served from GitHub`);
    const merged = this.mergeGitHubTemplate(githubTemplate);
    const hydratedFields = await this.hydrateListFieldsForTenant(
      tenantUuid,
      merged.fields,
    );
    return { ...merged, fields: hydratedFields };
  }

  async getTreeLevel(
    tenantUuid: string,
    path = "",
    cursor = 0,
    limit = 50,
  ): Promise<TemplateTreeLevelResult> {
    await this.assertTenantExists(tenantUuid);
    return this.githubStorage.listTenantTreeLevel(
      tenantUuid,
      path,
      cursor,
      limit,
    );
  }

  async searchTemplates(
    tenantUuid: string,
    query: string,
    path = "",
    cursor = 0,
    limit = 50,
  ) {
    await this.assertTenantExists(tenantUuid);
    return this.githubStorage.searchTenantTemplates(
      tenantUuid,
      query,
      path,
      cursor,
      limit,
    );
  }

  async create({
    tenantUuid,
    name,
    content,
    fields,
    created_by = "system",
    path,
  }: CreateTemplateInput) {
    await this.assertTenantExists(tenantUuid);
    if (!name || name.trim().length === 0) {
      throw makeError("Template name is required", 400);
    }

    if (content === undefined || content === null) {
      throw makeError(
        "The 'content' field is missing from request body. " +
          "Use PUT /api/templates/:id to update an existing template",
        400,
      );
    }

    this.assertValidContent(content);

    const id = randomUUID();
    const contentPath = this.githubStorage.normalizeTenantTemplatePath(
      path ?? id,
    );
    const normalizedFields: FieldDefinition[] = normalizeFieldDefinitions(
      content,
      fields,
    );
    await this.templateFieldListsService.syncTemplateListsForTenant(
      tenantUuid,
      content,
    );
    const hydratedFields = await this.hydrateListFieldsForTenant(
      tenantUuid,
      normalizedFields,
    );

    await this.versioningService.updateTemplate(
      tenantUuid,
      contentPath,
      content,
      `chore: add template ${tenantUuid}/${contentPath}`,
    );
    await this.auditLogsService.recordSafe({
      tenantUuid,
      eventType: "template.created",
      actor: created_by,
      templateId: `github:${tenantUuid}/${contentPath}`,
      payload: { path: contentPath, name: name.trim() },
    });
    const pathOnGitHub = this.githubStorage.filePathForTenant(
      tenantUuid,
      contentPath,
    );
    const meta = this.githubStorage.templateMetaFromTenantPath(
      tenantUuid,
      pathOnGitHub,
    );
    return this.mergeGitHubTemplate({
      id: `github:${tenantUuid}/${meta.templateId}`,
      name: name.trim(),
      content_path: meta.templateId,
      githubPath: pathOnGitHub,
      category: meta.category,
      section: meta.section,
      fields: hydratedFields,
      created_by,
      created_at: new Date(),
      updated_at: new Date(),
      content,
    });
  }

  async update(
    tenantUuid: string,
    id: string,
    { name, content, fields }: Omit<UpdateTemplateInput, "tenantUuid">,
  ) {
    await this.assertTenantExists(tenantUuid);
    const existing = await this.findOneOrThrow(tenantUuid, id);
    const nextContent = content ?? existing.content;
    this.assertValidContent(nextContent);

    const nextFields = normalizeFieldDefinitions(
      nextContent,
      fields ?? existing.fields,
    );
    await this.templateFieldListsService.syncTemplateListsForTenant(
      tenantUuid,
      nextContent,
    );
    const hydratedFields = await this.hydrateListFieldsForTenant(
      tenantUuid,
      nextFields,
    );
    const templateId = this.githubStorage.normalizeTenantTemplatePath(
      existing.id,
    );

    await this.versioningService.updateTemplate(
      tenantUuid,
      templateId,
      nextContent,
      `chore: update template ${tenantUuid}/${templateId}`,
    );
    await this.auditLogsService.recordSafe({
      tenantUuid,
      eventType: "template.updated",
      templateId: `github:${tenantUuid}/${templateId}`,
      payload: { path: templateId, renamed: Boolean(name?.trim()) },
    });
    const pathOnGitHub = this.githubStorage.filePathForTenant(
      tenantUuid,
      templateId,
    );
    const meta = this.githubStorage.templateMetaFromTenantPath(
      tenantUuid,
      pathOnGitHub,
    );
    return this.mergeGitHubTemplate({
      id: `github:${tenantUuid}/${meta.templateId}`,
      name: name?.trim() || existing.name,
      content_path: meta.templateId,
      githubPath: pathOnGitHub,
      category: meta.category,
      section: meta.section,
      fields: hydratedFields,
      created_by: existing.created_by,
      created_at: existing.created_at,
      updated_at: new Date(),
      content: nextContent,
    });
  }

  async delete(tenantUuid: string, id: string) {
    await this.assertTenantExists(tenantUuid);
    const contentPath = this.githubStorage.normalizeTenantTemplatePath(id);
    await this.githubStorage.deleteTemplateForTenant(tenantUuid, contentPath);
    await this.auditLogsService.recordSafe({
      tenantUuid,
      eventType: "template.deleted",
      templateId: `github:${tenantUuid}/${contentPath}`,
      payload: { path: contentPath },
    });
    return { deleted: true };
  }
}
