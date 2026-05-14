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
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { toTemplateResponse } from "../common/mappers/response.mapper";
import { makeError } from "../common/utils/errors";
import {
  assertUuid,
  getActor,
  parsePagination,
} from "../common/utils/http.utils";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { CreateTemplateDto } from "../dto/create-template.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { GeneratePdfDto } from "../dto/generate-pdf.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { TemplateQueryDto } from "../dto/template-query.dto";
// biome-ignore lint/style/useImportType: Nest uses DTO classes for runtime validation metadata.
import { UpdateTemplateDto } from "../dto/update-template.dto";
import type { FieldValueMap } from "../service/document-rendering.service";
import { PdfJobsService } from "../service/pdf-jobs.service";
import { TemplatesService } from "../service/templates.service";

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

function toPdfJobResponse(job: {
  id: string;
  template_id: string;
  status: string;
  filename: string | null;
  field_values: Record<string, unknown>;
  template_content_hash: string | null;
  field_values_hash: string | null;
  rendered_content_hash: string | null;
  unresolved_fields: string[];
  error_message: string | null;
  requested_by: string;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}) {
  return {
    id: job.id,
    templateId: job.template_id,
    status: job.status,
    filename: job.filename,
    fieldValues: job.field_values,
    templateContentHash: job.template_content_hash,
    fieldValuesHash: job.field_values_hash,
    renderedContentHash: job.rendered_content_hash,
    unresolvedFields: job.unresolved_fields,
    errorMessage: job.error_message,
    requestedBy: job.requested_by,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
  };
}

@ApiTags("templates")
@Controller("templates")
export class TemplatesController {
  constructor(
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
    @Inject(PdfJobsService)
    private readonly pdfJobsService: PdfJobsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List templates" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  findAll(@Query() query: TemplateQueryDto) {
    const { limit, offset } = parsePagination(query);
    return this.templatesService.findAll({ limit, offset }).then((result) => ({
      ...result,
      data: result.data.map(toTemplateResponse),
    }));
  }

  @Get(":id")
  @ApiOperation({ summary: "Template details" })
  @ApiParam({ name: "id", description: "Template UUID" })
  @ApiResponse({ status: 404, description: "Template not found" })
  async findOne(@Param("id") id: string) {
    const template = await this.templatesService.findOne(id);
    if (!template) throw makeError("Template not found", 404);
    return toTemplateResponse(template);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create template" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async create(@Body() body: CreateTemplateDto, @Req() request: Request) {
    const template = await this.templatesService.create({
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
  @ApiParam({ name: "id", description: "Template UUID" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async update(@Param("id") id: string, @Body() body: UpdateTemplateDto) {
    const template = await this.templatesService.update(id, {
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
  @ApiParam({ name: "id", description: "Template UUID" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  delete(@Param("id") id: string) {
    return this.templatesService.delete(id);
  }

  @Post(":id/pdf")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Start PDF generation from template" })
  @ApiParam({ name: "id", description: "Template UUID" })
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
    );
    return toPdfJobResponse(job);
  }

  @Get(":id/pdf/jobs")
  @ApiOperation({ summary: "List template PDF jobs" })
  @ApiParam({ name: "id", description: "Template UUID" })
  async getPdfJobs(@Param("id") id: string) {
    assertTemplatePathParam(id);
    const jobs = await this.pdfJobsService.getJobs(id);
    return jobs.map(toPdfJobResponse);
  }

  @Get(":id/pdf/jobs/:jobId")
  @ApiOperation({ summary: "PDF job details" })
  @ApiParam({ name: "id", description: "Template UUID" })
  @ApiParam({ name: "jobId", description: "Job UUID" })
  async getPdfJob(@Param("id") id: string, @Param("jobId") jobId: string) {
    assertTemplatePathParam(id);
    assertUuid(jobId, "jobId");
    return toPdfJobResponse(await this.pdfJobsService.getJob(id, jobId));
  }

  @Get(":id/pdf/jobs/:jobId/download")
  @ApiOperation({ summary: "Download PDF from specific job" })
  @ApiParam({ name: "id", description: "Template UUID" })
  @ApiParam({ name: "jobId", description: "Job UUID" })
  async downloadPdfJob(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ) {
    assertTemplatePathParam(id);
    assertUuid(jobId, "jobId");
    await this.pdfJobsService.streamDownload(id, jobId, response);
  }

  @Get(":id/pdf/latest")
  @ApiOperation({ summary: "Download latest completed PDF" })
  @ApiParam({ name: "id", description: "Template UUID" })
  async downloadLatestPdf(
    @Param("id") id: string,
    @Query("fieldValues") fieldValuesRaw: string | undefined,
    @Res() response: Response,
  ) {
    assertTemplatePathParam(id);
    const fieldValues = parseFieldValuesQuery(fieldValuesRaw);
    await this.pdfJobsService.streamLatest(id, response, fieldValues);
  }
}
