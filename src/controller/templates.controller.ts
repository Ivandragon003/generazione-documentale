import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  toPdfJobResponse,
  toTemplateResponse,
} from "../common/mappers/response.mapper";
import { makeError } from "../common/utils/errors";
import {
  assertUuid,
  getActor,
  parsePagination,
} from "../common/utils/http.utils";
import { validateMarkdownContent } from "../common/utils/markdown.utils";
import { appConfig } from "../config/app.config";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { CreateTemplateDto } from "../dto/create-template.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { GeneratePdfDto } from "../dto/generate-pdf.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { GenerateTemplateDraftDto } from "../dto/generate-template-draft.dto";
import type { RepairTemplateDraftDto } from "../dto/repair-template-draft.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { TemplateQueryDto } from "../dto/template-query.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { UpdateTemplateDto } from "../dto/update-template.dto";
import { AuditLogsService } from "../service/audit-logs.service";
import type { FieldValueMap } from "../service/document-rendering.service";
import { GitTemplateVersioningService } from "../service/git-template-versioning.service";
import { PdfGenerationService } from "../service/pdf-generation.service";
import { PdfJobsService } from "../service/pdf-jobs.service";
import { TemplateAuditService } from "../service/template-audit.service";
import { TemplateDraftGenerationService } from "../service/template-draft-generation.service";
import { TemplateFieldListsService } from "../service/template-field-lists.service";
import { TemplatesService } from "../service/templates.service";
import { TenantProvider } from "../service/tenant-provider.service";

type RequestWithRawBody = Request & { rawBody?: Buffer };

function isFieldValueMap(value: unknown): value is FieldValueMap {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseRawFieldValues(request: Request): FieldValueMap | null {
  const rawBody = (request as RequestWithRawBody).rawBody;
  if (!rawBody || rawBody.length === 0) return null;

  const parsed = JSON.parse(rawBody.toString("utf8")) as {
    fieldValues?: unknown;
  };
  if (parsed.fieldValues === undefined) return {};
  if (!isFieldValueMap(parsed.fieldValues)) {
    throw makeError("fieldValues must be an object", 400);
  }
  return parsed.fieldValues;
}

function resolveFieldValues(
  body: GeneratePdfDto,
  request: Request,
): FieldValueMap {
  const rawFieldValues = parseRawFieldValues(request);
  if (rawFieldValues) return rawFieldValues;
  return body.fieldValues ?? {};
}

function assertTemplatePathParam(id: string): void {
  if (!id || id.trim().length === 0) {
    throw makeError("invalid template id", 400);
  }
}

function scopeTemplateIdForTenant(id: string, tenantUuid?: string): string {
  const normalizedTenant = tenantUuid?.trim();
  if (!normalizedTenant) return id;
  const normalizedId = id.startsWith("github:") ? id.slice(7) : id;
  if (normalizedId.startsWith(`${normalizedTenant}/`)) return id;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\//i.test(
      normalizedId,
    )
  ) {
    return id;
  }
  return `github:${normalizedTenant}/${normalizedId}`;
}

const DEFAULT_TENANT_UUID = "11111111-1111-1111-1111-111111111111";

function resolveTenantUuid(
  request: Request,
  queryTenant?: string,
  bodyTenant?: string,
): string {
  const fromHeader = request.header("x-tenant-uuid");
  const tenantUuid = (queryTenant || bodyTenant || fromHeader || "").trim();
  return tenantUuid || DEFAULT_TENANT_UUID;
}

function parseFieldValuesQuery(raw: string | undefined): FieldValueMap {
  if (!raw || raw.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isFieldValueMap(parsed)) {
      throw makeError("fieldValues query must be a JSON object", 400);
    }
    return parsed;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 400
    ) {
      throw error;
    }
    throw makeError("invalid fieldValues query: malformed JSON", 400);
  }
}

@ApiTags("templates")
@Controller("templates")
export class TemplatesController {
  constructor(
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
    @Inject(PdfJobsService)
    private readonly pdfJobsService: PdfJobsService,
    @Inject(PdfGenerationService)
    private readonly pdfGenerationService: PdfGenerationService,
    @Inject(GitTemplateVersioningService)
    private readonly templateVersioning: GitTemplateVersioningService,
    @Inject(TenantProvider)
    private readonly tenantProvider: TenantProvider,
    @Inject(TemplateFieldListsService)
    private readonly templateFieldListsService: TemplateFieldListsService,
    @Inject(AuditLogsService)
    private readonly auditLogsService: AuditLogsService,
    @Inject(TemplateAuditService)
    private readonly templateAuditService: TemplateAuditService,
    @Inject(TemplateDraftGenerationService)
    private readonly templateDraftGenerationService: TemplateDraftGenerationService,
  ) {}

  @Get("tenants")
  @ApiOperation({ summary: "List available tenants" })
  async listTenants() {
    return this.tenantProvider.getTenants();
  }

  @Get("tenants/:tenantUuid/template-lists")
  @ApiOperation({ summary: "List template lists for a tenant" })
  async listTemplateLists(@Param("tenantUuid") tenantUuid: string) {
    return this.templateFieldListsService.listTemplateListsForTenant(
      tenantUuid,
    );
  }

  @Get("tenants/:tenantUuid/template-lists/:listName")
  @ApiOperation({ summary: "Get one template list by tenant and list name" })
  async getTemplateList(
    @Param("tenantUuid") tenantUuid: string,
    @Param("listName") listName: string,
  ) {
    const values = await this.templateFieldListsService.getListValuesForTenant(
      tenantUuid,
      listName,
    );
    return { tenantUuid, listName, values };
  }

  @Get("tenants/:tenantUuid/audit-logs")
  @ApiOperation({ summary: "List tenant audit logs" })
  async listAuditLogs(
    @Param("tenantUuid") tenantUuid: string,
    @Query("templateId") templateId?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const parsedLimit = Number.parseInt(limit ?? "50", 10);
    const parsedOffset = Number.parseInt(offset ?? "0", 10);
    return this.auditLogsService.listByTenant(
      tenantUuid,
      templateId,
      Number.isFinite(parsedLimit) ? parsedLimit : 50,
      Number.isFinite(parsedOffset) ? parsedOffset : 0,
    );
  }

  @Put("tenants/:tenantUuid/template-lists/:listName")
  @ApiOperation({ summary: "Create or update a template list for a tenant" })
  async upsertTemplateList(
    @Param("tenantUuid") tenantUuid: string,
    @Param("listName") listName: string,
    @Body() body: { values: string[] },
  ) {
    const item = await this.templateFieldListsService.upsertTemplateFieldList(
      tenantUuid,
      listName,
      body.values ?? [],
    );
    return {
      id: item.id,
      tenantUuid: item.tenant_uuid,
      listName: item.list_name,
      values: item.values,
      updatedAt: item.updated_at,
    };
  }

  @Get()
  @ApiOperation({ summary: "List templates" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  findAll(@Query() query: TemplateQueryDto, @Req() request: Request) {
    const { limit, offset } = parsePagination(query);
    const tenantUuid = resolveTenantUuid(request, query.tenantUuid);
    return this.templatesService
      .findAll({ tenantUuid, limit, offset })
      .then((result) => ({
        ...result,
        data: result.data.map(toTemplateResponse),
      }));
  }

  @Get("tree")
  @ApiOperation({ summary: "List tenant template tree level (lazy)" })
  async getTemplateTree(
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
    @Query("path") path?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    const parsedCursor = Number.parseInt(cursor ?? "0", 10);
    const parsedLimit = Number.parseInt(limit ?? "50", 10);
    return this.templatesService.getTreeLevel(
      tenantUuid,
      path ?? "",
      Number.isFinite(parsedCursor) ? parsedCursor : 0,
      Number.isFinite(parsedLimit) ? parsedLimit : 50,
    );
  }

  @Get("search")
  @ApiOperation({ summary: "Search templates in tenant (server-side)" })
  async searchTemplates(
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
    @Query("q") q?: string,
    @Query("path") path?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    const query = (q ?? "").trim();
    if (!query) return { items: [], nextCursor: null };
    const parsedCursor = Number.parseInt(cursor ?? "0", 10);
    const parsedLimit = Number.parseInt(limit ?? "50", 10);
    const safeLimit = Math.min(
      100,
      Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 50),
    );
    return this.templatesService.searchTemplates(
      tenantUuid,
      query,
      path ?? "",
      Number.isFinite(parsedCursor) ? parsedCursor : 0,
      safeLimit,
    );
  }

  @Get(":id/content")
  @ApiOperation({ summary: "Get one template content (lazy load markdown)" })
  async getOne(
    @Param("id") id: string,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    const template = await this.templatesService.findOne(tenantUuid, id);
    if (!template) throw makeError("Template not found", 404);
    return toTemplateResponse(template);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create template" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async create(
    @Body() body: CreateTemplateDto,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(
      request,
      tenantUuidQuery,
      body.tenantUuid,
    );
    const template = await this.templatesService.create({
      tenantUuid,
      name: body.name,
      content: body.content,
      fields: body.fields,
      created_by: getActor(request),
      path: body.path,
    });
    if (!template) throw makeError("Template not found", 404);
    return toTemplateResponse(template);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update template" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async update(
    @Param("id") id: string,
    @Body() body: UpdateTemplateDto,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(
      request,
      tenantUuidQuery,
      body.tenantUuid,
    );
    const template = await this.templatesService.update(tenantUuid, id, {
      name: body.name,
      content: body.content,
      fields: body.fields,
    });
    if (!template) throw makeError("Template not found", 404);
    return toTemplateResponse(template);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete template" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  delete(
    @Param("id") id: string,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    return this.templatesService.delete(tenantUuid, id);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "List template versions from Git history" })
  async listTemplateVersions(
    @Param("id") id: string,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    return this.templateVersioning.listTemplateVersions(tenantUuid, id);
  }

  @Get(":id/versions/:commitSha")
  @ApiOperation({
    summary: "Get template content for a specific commit version",
  })
  async getTemplateVersionContent(
    @Param("id") id: string,
    @Param("commitSha") commitSha: string,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    const content = await this.templateVersioning.getTemplateVersionContent(
      tenantUuid,
      id,
      commitSha,
    );
    return { content, commitSha };
  }

  @Post(":id/versions/:commitSha/restore")
  @ApiOperation({ summary: "Restore a template content from a past version" })
  async restoreTemplateVersion(
    @Param("id") id: string,
    @Param("commitSha") commitSha: string,
    @Req() request: Request,
    @Query("tenantUuid") tenantUuidQuery?: string,
  ) {
    const tenantUuid = resolveTenantUuid(request, tenantUuidQuery);
    return this.templateVersioning.restoreTemplateVersion(
      tenantUuid,
      id,
      commitSha,
    );
  }

  @Post("validate")
  @ApiOperation({
    summary: "Validate template markdown syntax and placeholders",
  })
  async validateTemplate(@Body() body: { content: string; runAi?: boolean }) {
    const legacy = validateMarkdownContent(
      body?.content ?? "",
      appConfig.maxTemplateContentBytes,
    );
    const report = await this.templateAuditService.audit({
      content: body?.content ?? "",
      runAi: body?.runAi ?? false,
    });
    return {
      ...legacy,
      deterministic: report.deterministic,
      ai: report.ai,
    };
  }

  @Post("audit")
  @ApiOperation({
    summary: "Run deterministic + AI semantic audit for a template markdown",
  })
  async auditTemplate(@Body() body: { content: string; runAi?: boolean }) {
    const report = await this.templateAuditService.audit({
      content: body?.content ?? "",
      runAi: body?.runAi ?? true,
    });
    return {
      deterministic: {
        errors: report.deterministic.errors,
        warnings: report.deterministic.warnings,
        durationMs: report.deterministic.durationMs,
      },
      ai: report.ai
        ? {
            warnings: report.ai.warnings,
            provider: report.ai.provider,
            model: report.ai.model,
            latencyMs: report.ai.latencyMs,
            ...(report.ai.failed ? { failed: true } : {}),
            ...(report.ai.error ? { error: report.ai.error } : {}),
          }
        : null,
    };
  }

  @Post("generate-draft")
  @ApiOperation({
    summary:
      "Generate an AI-assisted markdown draft and validate it deterministically",
  })
  async generateDraft(@Body() body: GenerateTemplateDraftDto) {
    return this.templateDraftGenerationService.generateDraft({
      description: body.description,
      language: body.language,
      runSemanticAudit: body.runSemanticAudit ?? false,
      generationMode: body.generationMode ?? "guided",
      autoRepair: body.autoRepair ?? false,
      defaultLength: body.defaultLength,
    });
  }

  @Post("repair-draft")
  @ApiOperation({
    summary:
      "Apply safe deterministic placeholder corrections on current markdown and revalidate",
  })
  async repairDraft(@Body() body: RepairTemplateDraftDto) {
    return this.templateDraftGenerationService.repairDraft({
      content: body.content,
      language: body.language,
      runSemanticAudit: body.runSemanticAudit ?? false,
      generationMode: body.generationMode ?? "guided",
      defaultLength: body.defaultLength,
    });
  }

  @Post(":id/pdf")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Start PDF generation from template" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async generatePdf(
    @Param("id") id: string,
    @Body() body: GeneratePdfDto,
    @Req() request: Request,
  ) {
    assertTemplatePathParam(id);
    const job = await this.pdfJobsService.enqueue(
      id,
      resolveFieldValues(body, request),
      getActor(request),
      body.language,
    );
    return toPdfJobResponse(job);
  }

  @Post(":id/docx")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Generate DOCX from template and download it" })
  @ApiParam({ name: "id", description: "Template UUID or github:<path>" })
  async generateDocx(
    @Param("id") id: string,
    @Body() body: GeneratePdfDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    assertTemplatePathParam(id);
    const templateId = await this.templatesService.resolveTemplateIdForPdfJob(
      id,
      true,
    );
    if (!templateId) throw makeError("Template not found", 404);
    const template = await this.templatesService.findOne(templateId);
    if (!template) throw makeError("Template not found", 404);

    const generated = await this.pdfGenerationService.generateDocx({
      title: template.name,
      content: template.content,
      fieldValues: resolveFieldValues(body, request),
      strict: false,
      language: body.language,
    });
    const stream = await this.pdfGenerationService.getFileStream(
      generated.filename,
    );
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional sanitization of control chars for Content-Disposition safety
    const UNSAFE_FILENAME_CHARS = /[\x00-\x1f"\\]/g;
    const safeName =
      (template.name || "document")
        .replace(UNSAFE_FILENAME_CHARS, "-")
        .replace(/\s+/g, " ")
        .trim() || "document";
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.docx"`,
    );
    await new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      response.on("error", reject);
      response.on("finish", resolve);
      stream.pipe(response);
    });
  }

  @Get(":id/pdf/jobs")
  @ApiOperation({ summary: "List template PDF jobs" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  async getPdfJobs(@Param("id") id: string) {
    assertTemplatePathParam(id);
    const jobs = await this.pdfJobsService.getJobs(id);
    return jobs.map(toPdfJobResponse);
  }

  @Get(":id/pdf/jobs/:jobId")
  @ApiOperation({ summary: "PDF job details" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  @ApiParam({ name: "jobId", description: "Job UUID" })
  async getPdfJob(@Param("id") id: string, @Param("jobId") jobId: string) {
    assertTemplatePathParam(id);
    assertUuid(jobId, "jobId");
    return toPdfJobResponse(await this.pdfJobsService.getJob(id, jobId));
  }

  @Get(":id/pdf/jobs/:jobId/download")
  @ApiOperation({ summary: "Download completed PDF job" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  @ApiParam({ name: "jobId", description: "Job UUID" })
  @ApiQuery({ name: "tenantUuid", required: false, type: String })
  async downloadPdfJob(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Query("tenantUuid") tenantUuidQuery: string | undefined,
    @Res() response: Response,
  ) {
    assertTemplatePathParam(id);
    assertUuid(jobId, "jobId");
    await this.pdfJobsService.streamDownload(
      scopeTemplateIdForTenant(id, tenantUuidQuery),
      jobId,
      response,
    );
  }

  @Get(":id/pdf/latest")
  @ApiOperation({ summary: "Download latest completed PDF" })
  @ApiParam({ name: "id", description: "Template id (github:<path>)" })
  @ApiQuery({ name: "language", required: false, type: String })
  async downloadLatestPdf(
    @Param("id") id: string,
    @Query("fieldValues") fieldValuesRaw: string | undefined,
    @Query("language") language: string | undefined,
    @Res() response: Response,
  ) {
    assertTemplatePathParam(id);
    const fieldValues = parseFieldValuesQuery(fieldValuesRaw);
    await this.pdfJobsService.streamLatest(id, response, fieldValues, language);
  }
}
