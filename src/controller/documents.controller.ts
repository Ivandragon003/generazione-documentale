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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  toDocumentResponse,
  toPdfJobResponse,
} from "../common/mappers/response.mapper";
import { makeError } from "../common/utils/errors";
import { getActor, parsePagination } from "../common/utils/http.utils";
import type { CreateDocumentDto } from "../dto/create-document.dto";
import type { DocumentQueryDto } from "../dto/document-query.dto";
import type { UpdateDocumentDto } from "../dto/update-document.dto";
import { DocumentsService } from "../service/documents.service";
import { PdfJobsService } from "../service/pdf-jobs.service";
import { PreviewService } from "../service/preview.service";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(
    @Inject(DocumentsService)
    private readonly documentsService: DocumentsService,
    @Inject(PdfJobsService)
    private readonly pdfJobsService: PdfJobsService,
    @Inject(PreviewService)
    private readonly previewService: PreviewService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lista documenti" })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "generated", "published", "archived"],
  })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  findAll(@Query() query: DocumentQueryDto) {
    const { limit, offset } = parsePagination(query);
    return this.documentsService
      .findAll({
        status: query.status,
        limit,
        offset,
      })
      .then((result) => ({
        ...result,
        data: result.data.map(toDocumentResponse),
      }));
  }

  @Get(":id")
  @ApiOperation({ summary: "Dettaglio documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  @ApiResponse({ status: 404, description: "Documento non trovato" })
  async findOne(@Param("id") id: string) {
    const document = await this.documentsService.findOne(id);
    if (!document) {
      throw makeError("Documento non trovato", 404);
    }
    return toDocumentResponse(document);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Crea documento da template" })
  create(@Body() body: CreateDocumentDto, @Req() request: Request) {
    return this.documentsService
      .create({
        name: body.name,
        templateId: body.templateId,
        created_by: getActor(request),
      })
      .then((document) => toDocumentResponse(document));
  }

  @Put(":id")
  @ApiOperation({ summary: "Aggiorna documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  update(@Param("id") id: string, @Body() body: UpdateDocumentDto) {
    return this.documentsService
      .update(id, {
        name: body.name,
        content: body.content,
        fieldValues: body.fieldValues,
      })
      .then((document) => toDocumentResponse(document));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  delete(@Param("id") id: string) {
    return this.documentsService.delete(id);
  }

  @Post(":id/pdf")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Avvia generazione PDF" })
  @ApiResponse({
    status: 202,
    description: "PDF job creato con successo - processing avviato",
  })
  @ApiResponse({
    status: 404,
    description: "Documento o template non trovato",
  })
  @ApiResponse({
    status: 422,
    description: "Campi obbligatori non compilati",
  })
  enqueuePdf(@Param("id") id: string, @Req() request: Request) {
    return this.pdfJobsService
      .enqueuePdfGeneration(id, getActor(request))
      .then((job) => toPdfJobResponse(job));
  }

  @Get(":id/pdf/jobs")
  @ApiOperation({ summary: "Lista job PDF del documento" })
  getPdfJobs(@Param("id") id: string) {
    return this.pdfJobsService
      .getPdfJobs(id)
      .then((jobs) => jobs.map(toPdfJobResponse));
  }

  @Get(":id/pdf/jobs/:jobId")
  @ApiOperation({ summary: "Stato job PDF" })
  getPdfJob(@Param("id") id: string, @Param("jobId") jobId: string) {
    return this.pdfJobsService
      .getPdfJob(id, jobId)
      .then((job) => (job ? toPdfJobResponse(job) : null));
  }

  @Get(":id/pdf/jobs/:jobId/download")
  @ApiOperation({ summary: "Download PDF completato" })
  async downloadPdf(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ) {
    await this.pdfJobsService.streamPdfJobDownload(id, jobId, response);
  }

  @Delete(":id/pdf/jobs/:jobId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina PDF generato" })
  async deletePdf(@Param("id") id: string, @Param("jobId") jobId: string) {
    await this.pdfJobsService.deleteGeneratedPdf(id, jobId);
  }

  @Get(":id/pdf/latest")
  @ApiOperation({ summary: "Download ultimo PDF completato" })
  async downloadLatestPdf(@Param("id") id: string, @Res() response: Response) {
    await this.pdfJobsService.streamLatestPdfDownload(id, response);
  }

  @Get(":id/preview")
  @ApiOperation({ summary: "Anteprima documento renderizzata (no PDF)" })
  async previewDocument(@Param("id") id: string, @Res() response: Response) {
    const preview = await this.previewService.getMarkdownPreview(id);
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.send(preview.content);
  }
}
