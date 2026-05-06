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
import { makeError } from "../common/utils/errors";
import { getActor, parsePagination } from "../common/utils/http.utils";
import type { CreateDocumentDto } from "../dto/create-document.dto";
import type { DocumentQueryDto } from "../dto/document-query.dto";
import type { UpdateDocumentDto } from "../dto/update-document.dto";
import { DocumentsService } from "../service/documents.service";
import { deletePdf, getPdfStream } from "../service/pdf.service";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(
    @Inject(DocumentsService)
    private readonly documentsService: DocumentsService,
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
    return this.documentsService.findAll({
      status: query.status,
      limit,
      offset,
    });
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
    return document;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Crea documento da template" })
  create(@Body() body: CreateDocumentDto, @Req() request: Request) {
    return this.documentsService.create({
      name: body.name,
      templateId: body.templateId,
      created_by: getActor(request),
    });
  }

  @Put(":id")
  @ApiOperation({ summary: "Aggiorna documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  update(@Param("id") id: string, @Body() body: UpdateDocumentDto) {
    return this.documentsService.update(id, {
      name: body.name,
      content: body.content,
      fieldValues: body.fieldValues,
    });
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
  enqueuePdf(@Param("id") id: string, @Req() request: Request) {
    return this.documentsService.enqueuePdfGeneration(id, getActor(request));
  }

  @Get(":id/pdf/jobs")
  @ApiOperation({ summary: "Lista job PDF del documento" })
  getPdfJobs(@Param("id") id: string) {
    return this.documentsService.getPdfJobs(id);
  }

  @Get(":id/pdf/jobs/:jobId")
  @ApiOperation({ summary: "Stato job PDF" })
  getPdfJob(@Param("id") id: string, @Param("jobId") jobId: string) {
    return this.documentsService.getPdfJob(id, jobId);
  }

  @Get(":id/pdf/jobs/:jobId/download")
  @ApiOperation({ summary: "Download PDF completato" })
  async downloadPdf(
    @Param("id") id: string,
    @Param("jobId") jobId: string,
    @Res() response: Response,
  ) {
    const job = await this.documentsService.getCompletedPdfJob(id, jobId);
    if (!job.filename) throw makeError("PDF non ancora disponibile", 409);
    const stream = await getPdfStream(job.filename);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    stream.pipe(response);
  }

  @Delete(":id/pdf/jobs/:jobId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina PDF generato" })
  async deletePdf(@Param("id") id: string, @Param("jobId") jobId: string) {
    const job = await this.documentsService.getCompletedPdfJob(id, jobId);
    if (!job.filename) throw makeError("PDF non ancora disponibile", 409);
    await deletePdf(job.filename);
  }

  @Get(":id/pdf/latest")
  @ApiOperation({ summary: "Download ultimo PDF completato" })
  async downloadLatestPdf(@Param("id") id: string, @Res() response: Response) {
    const job = await this.documentsService.getLatestCompletedPdfJob(id);
    if (!job.filename) throw makeError("PDF non ancora disponibile", 409);
    const stream = await getPdfStream(job.filename);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );
    stream.pipe(response);
  }

  @Get(":id/pdf/preview")
  @ApiOperation({ summary: "Anteprima PDF (senza salvataggio)" })
  previewPdf(@Param("id") id: string) {
    return this.documentsService.previewPdf(id);
  }
}
