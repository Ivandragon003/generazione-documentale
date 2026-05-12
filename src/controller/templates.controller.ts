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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
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
  getActor,
  parsePagination,
  readAndCleanupUpload,
} from "../common/utils/http.utils";
import { appConfig } from "../config/app.config";
import type { CreateTemplateDto } from "../dto/create-template.dto";
import type { GeneratePdfDto } from "../dto/generate-pdf.dto";
import { ImportTemplateFileDto } from "../dto/import-template-file.dto";
import type { TemplateQueryDto } from "../dto/template-query.dto";
import type { UpdateTemplateDto } from "../dto/update-template.dto";
import type { ValidateMarkdownDto } from "../dto/validate-markdown.dto";
import { PdfJobsService } from "../service/pdf-jobs.service";
import { TemplatesService } from "../service/templates.service";

const UPLOAD_PATH = appConfig.uploadPath;
const MAX_FILE_SIZE = appConfig.maxFileSizeBytes;

interface UploadedMarkdownFile {
  path: string;
  originalname: string;
  mimetype: string;
}

const multerOptions = {
  dest: UPLOAD_PATH,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (
    _request: Request,
    file: UploadedMarkdownFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (
      file.originalname.endsWith(".md") ||
      file.mimetype === "text/markdown" ||
      file.mimetype === "text/plain"
    ) {
      callback(null, true);
      return;
    }
    callback(new Error("Formato file non supportato. Accettati: .md"), false);
  },
};

function toPdfJobResponse(job: {
  id: string;
  template_id: string;
  status: string;
  filename: string | null;
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
  @ApiOperation({ summary: "Lista template" })
  @ApiQuery({ name: "status", required: false, enum: ["draft", "published"] })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  findAll(@Query() query: TemplateQueryDto) {
    const { limit, offset } = parsePagination(query);
    return this.templatesService
      .findAll({ status: query.status, limit, offset })
      .then((result) => ({ ...result, data: result.data.map(toTemplateResponse) }));
  }

  @Get(":id")
  @ApiOperation({ summary: "Dettaglio template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiResponse({ status: 404, description: "Template non trovato" })
  async findOne(@Param("id") id: string) {
    const template = await this.templatesService.findOne(id);
    if (!template) throw makeError("Template non trovato", 404);
    return toTemplateResponse(template);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Crea template" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async create(@Body() body: CreateTemplateDto, @Req() request: Request) {
    const template = await this.templatesService.create({
      name: body.name,
      description: body.description,
      content: body.content,
      fields: body.fields,
      status: body.status,
      created_by: getActor(request),
    });
    if (!template) throw makeError("Template non trovato", 404);
    return toTemplateResponse(template);
  }

  @Put(":id")
  @ApiOperation({ summary: "Aggiorna template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async update(@Param("id") id: string, @Body() body: UpdateTemplateDto) {
    const template = await this.templatesService.update(id, {
      name: body.name,
      description: body.description,
      content: body.content,
      fields: body.fields,
      status: body.status,
    });
    if (!template) throw makeError("Template non trovato", 404);
    return toTemplateResponse(template);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  delete(@Param("id") id: string) {
    return this.templatesService.delete(id);
  }

  @Get(":id/export")
  @ApiOperation({ summary: "Esporta template come file .md" })
  @ApiParam({ name: "id", description: "UUID template" })
  async export(@Param("id") id: string, @Res() response: Response) {
    const template = await this.templatesService.findOne(id);
    if (!template) throw makeError("Template non trovato", 404);
    const content = this.templatesService.getExportContent(template);
    response.setHeader("Content-Type", "text/markdown");
    response.setHeader("Content-Disposition", `attachment; filename="${template.name}.md"`);
    response.send(content);
  }

  @Post("import")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file", multerOptions))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: ImportTemplateFileDto })
  @ApiOperation({ summary: "Importa template da file .md" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async import(
    @UploadedFile() file: UploadedMarkdownFile,
    @Body() body: ImportTemplateFileDto,
    @Req() request: Request,
  ) {
    if (!file) throw makeError("File non fornito", 400);
    const content = await readAndCleanupUpload(file);
    const name = body.name || file.originalname.replace(/\.md$/i, "");
    const template = await this.templatesService.importFromMarkdown(content, name, getActor(request));
    if (!template) throw makeError("Template non trovato", 404);
    return toTemplateResponse(template);
  }

  @Post("validate")
  @ApiOperation({ summary: "Valida contenuto Markdown" })
  validate(@Body() body: ValidateMarkdownDto) {
    return this.templatesService.validateMarkdown(body.content);
  }

  // ─── PDF endpoints (sostituiscono /api/documents/:id/pdf) ────────────────────

  @Post(":id/pdf")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Avvia generazione PDF da template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiHeader({ name: "x-user", required: false, example: "ivan" })
  async generatePdf(
    @Param("id") id: string,
    @Body() body: GeneratePdfDto,
    @Req() request: Request,
  ) {
    const job = await this.pdfJobsService.enqueue(
      id,
      body.fieldValues ?? {},
      getActor(request),
    );
    return toPdfJobResponse(job);
  }

  @Get(":id/pdf/jobs")
  @ApiOperation({ summary: "Lista job PDF del template" })
  @ApiParam({ name: "id", description: "UUID template" })
  async getPdfJobs(@Param("id") id: string) {
    const jobs = await this.pdfJobsService.getJobs(id);
    return jobs.map(toPdfJobResponse);
  }

  @Get(":id/pdf/jobs/:jobId")
  @ApiOperation({ summary: "Dettaglio job PDF" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiParam({ name: "jobId", description: "UUID job" })
  async getPdfJob(@Param("id") id: string, @Param("jobId") jobId: string) {
    return toPdfJobResponse(await this.pdfJobsService.getJob(id, jobId));
  }

  @Get(":id/pdf/jobs/:jobId/download")
  @ApiOperation({ summary: "Scarica PDF da job specifico" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiParam({ name: "jobId", description: "UUID job" })
  async downloadPdfJob(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ) {
    await this.pdfJobsService.streamDownload(id, jobId, response);
  }

  @Get(":id/pdf/latest")
  @ApiOperation({ summary: "Scarica l'ultimo PDF completato" })
  @ApiParam({ name: "id", description: "UUID template" })
  async downloadLatestPdf(@Param("id") id: string, @Res() response: Response) {
    await this.pdfJobsService.streamLatest(id, response);
  }
}
