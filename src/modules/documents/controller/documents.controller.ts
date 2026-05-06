import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { makeError } from "../../../common/utils/errors";
import {
  getActor,
  parsePagination,
  parseVersionOrThrow,
} from "../../../common/utils/http.utils";
import { AuditService } from "../../audit/service/audit.service";
import { CreateDocumentDto } from "../dto/create-document.dto";
import { DocumentQueryDto } from "../dto/document-query.dto";
import { UpdateDocumentDto } from "../dto/update-document.dto";
import { DocumentsService } from "../service/documents.service";
import { deletePdf, getPdfStream } from "../service/pdf.service";

@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly auditService: AuditService,
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
  @ApiOperation({ summary: "Aggiorna contenuto/fieldValues documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateDocumentDto,
    @Req() request: Request,
  ) {
    return this.documentsService.update(id, {
      name: body.name,
      content: body.content,
      fieldValues: body.fieldValues,
      created_by: getActor(request),
    });
  }

  @Post(":id/generate-pdf")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Accoda generazione PDF asincrona" })
  @ApiParam({ name: "id", description: "UUID documento" })
  @ApiResponse({ status: 202, description: "Job PDF accodato" })
  async generatePdf(@Param("id") id: string, @Req() request: Request) {
    const job = await this.documentsService.enqueuePdfGeneration(
      id,
      getActor(request),
    );
    return {
      message: "Generazione PDF accodata",
      jobId: job.id,
      status: job.status,
      documentId: job.document_id,
    };
  }

  @Get(":id/pdf/latest")
  @ApiOperation({ summary: "Scarica l'ultimo PDF completato" })
  @ApiParam({ name: "id", description: "UUID documento" })
  @ApiResponse({ status: 200, description: "File PDF scaricato" })
  async latestPdf(@Param("id") id: string, @Res() response: Response) {
    const job = await this.documentsService.getLatestCompletedPdfJob(id);
    const stream = await getPdfStream(job.filename ?? "");

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.filename}"`,
    );

    stream.on("error", (error) => {
      response.status(500).end(error.message);
    });

    stream.pipe(response);
  }

  @Get(":id/preview-pdf")
  @ApiOperation({ summary: "Anteprima PDF temporanea (non salvata)" })
  @ApiParam({ name: "id", description: "UUID documento" })
  async previewPdf(@Param("id") id: string, @Res() response: Response) {
    const { filename } = await this.documentsService.previewPdf(id);
    const stream = await getPdfStream(filename);

    response.setHeader("Content-Type", "application/pdf");
    response.setHeader(
      "Content-Disposition",
      'inline; filename="preview-temporanea.pdf"',
    );

    stream.on("error", (error) => {
      response.status(500).end(error.message);
    });

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      deletePdf(filename).catch(() => undefined);
    };

    response.on("finish", cleanup);
    response.on("close", cleanup);

    stream.pipe(response);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "Cronologia versioni documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  getVersions(@Param("id") id: string) {
    return this.documentsService.getVersions(id);
  }

  @Get(":id/versions/:version")
  @ApiOperation({
    summary: "Contenuto di una versione specifica del documento",
  })
  @ApiParam({ name: "id", description: "UUID documento" })
  @ApiParam({ name: "version", description: "Numero versione" })
  async getVersionContent(
    @Param("id") id: string,
    @Param("version") version: string,
  ) {
    const parsedVersion = parseVersionOrThrow(version);
    const documentVersion = await this.documentsService.getVersionContent(
      id,
      parsedVersion,
    );
    if (!documentVersion) {
      throw makeError("Versione non trovata", 404);
    }
    return documentVersion;
  }

  @Post(":id/restore/:version")
  @ApiOperation({ summary: "Ripristina una versione precedente del documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  @ApiParam({ name: "version", description: "Versione da ripristinare" })
  restoreVersion(
    @Param("id") id: string,
    @Param("version") version: string,
    @Req() request: Request,
  ) {
    const parsedVersion = parseVersionOrThrow(version);
    return this.documentsService.restore(id, parsedVersion, getActor(request));
  }

  @Get(":id/export-md")
  @ApiOperation({ summary: "Esporta documento come file .md" })
  @ApiParam({ name: "id", description: "UUID documento" })
  async exportMd(@Param("id") id: string, @Res() response: Response) {
    const document = await this.documentsService.findOne(id);
    if (!document) {
      throw makeError("Documento non trovato", 404);
    }

    const safeName = document.name.replace(/[^a-z0-9_-]/gi, "_");
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}.md"`,
    );
    response.send(document.content);
  }

  @Get(":id/audit")
  @ApiOperation({ summary: "Audit log del documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  getAudit(@Param("id") id: string, @Query() query: DocumentQueryDto) {
    const { limit, offset } = parsePagination(query, { limit: 50, offset: 0 });
    return this.auditService.findByEntity("document", id, { limit, offset });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Elimina documento" })
  @ApiParam({ name: "id", description: "UUID documento" })
  remove(@Param("id") id: string, @Req() request: Request) {
    return this.documentsService.delete(id, getActor(request));
  }
}
