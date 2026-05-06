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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
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
  readAndCleanupUpload,
} from "../../../common/utils/http.utils";
import type { AuditService } from "../../audit/service/audit.service";
import type { CreateTemplateDto } from "../dto/create-template.dto";
import type { ImportTemplateFileDto } from "../dto/import-template-file.dto";
import type { TemplateQueryDto } from "../dto/template-query.dto";
import type { UpdateTemplateDto } from "../dto/update-template.dto";
import type { ValidateMarkdownDto } from "../dto/validate-markdown.dto";
import type { TemplatesService } from "../service/templates.service";

const UPLOAD_PATH = process.env.UPLOAD_PATH ?? "./storage/uploads";
const MAX_FILE_SIZE =
  (Number.parseInt(process.env.MAX_FILE_SIZE_MB ?? "10", 10) || 10) *
  1024 *
  1024;

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

@ApiTags("templates")
@Controller("templates")
export class TemplatesController {
  constructor(
    private readonly templatesService: TemplatesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Lista template" })
  @ApiQuery({ name: "status", required: false, enum: ["draft", "published"] })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  findAll(@Query() query: TemplateQueryDto) {
    const { limit, offset } = parsePagination(query);
    return this.templatesService.findAll({
      status: query.status,
      limit,
      offset,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Dettaglio template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiResponse({ status: 404, description: "Template non trovato" })
  async findOne(@Param("id") id: string) {
    const template = await this.templatesService.findOne(id);
    if (!template) {
      throw makeError("Template non trovato", 404);
    }
    return template;
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "Cronologia versioni template" })
  @ApiParam({ name: "id", description: "UUID template" })
  getVersions(@Param("id") id: string) {
    return this.templatesService.getVersions(id);
  }

  @Get(":id/versions/:version")
  @ApiOperation({ summary: "Contenuto di una versione specifica" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiParam({ name: "version", description: "Numero versione" })
  async getVersionContent(
    @Param("id") id: string,
    @Param("version") version: string,
  ) {
    const parsedVersion = parseVersionOrThrow(version);
    const content = await this.templatesService.getVersionContent(
      id,
      parsedVersion,
    );
    if (!content) {
      throw makeError("Versione non trovata", 404);
    }
    return content;
  }

  @Get(":id/audit")
  @ApiOperation({ summary: "Audit log del template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 50 })
  @ApiQuery({ name: "offset", required: false, type: Number, example: 0 })
  getAudit(@Param("id") id: string, @Query() query: TemplateQueryDto) {
    const { limit, offset } = parsePagination(query, { limit: 50, offset: 0 });
    return this.auditService.findByEntity("template", id, { limit, offset });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Crea template (JSON)" })
  create(@Body() body: CreateTemplateDto, @Req() request: Request) {
    return this.templatesService.create({
      name: body.name,
      description: body.description,
      content: body.content,
      fields: body.fields,
      created_by: getActor(request),
    });
  }

  @Post("upload")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file", multerOptions))
  @ApiOperation({ summary: "Importa template da file .md (multipart)" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        file: { type: "string", format: "binary" },
      },
    },
  })
  importFile(
    @UploadedFile() file: UploadedMarkdownFile | undefined,
    @Body() body: ImportTemplateFileDto,
    @Req() request: Request,
  ) {
    if (!file) {
      throw makeError("File mancante", 400);
    }

    const content = readAndCleanupUpload(file);
    const name = body.name ?? file.originalname.replace(".md", "");

    return this.templatesService.importFromMarkdown(
      content,
      name,
      getActor(request),
    );
  }

  @Post("validate-md")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Valida contenuto Markdown senza creare il template",
  })
  validateMd(@Body() body: ValidateMarkdownDto) {
    return this.templatesService.validateMarkdown(body.content);
  }

  @Put(":id")
  @ApiOperation({ summary: "Aggiorna template (crea nuova versione)" })
  @ApiParam({ name: "id", description: "UUID template" })
  update(
    @Param("id") id: string,
    @Body() body: UpdateTemplateDto,
    @Req() request: Request,
  ) {
    return this.templatesService.update(id, {
      name: body.name,
      description: body.description,
      content: body.content,
      fields: body.fields,
      created_by: getActor(request),
    });
  }

  @Post(":id/restore/:version")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Ripristina una versione precedente del template" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiParam({ name: "version", description: "Versione da ripristinare" })
  restore(
    @Param("id") id: string,
    @Param("version") version: string,
    @Req() request: Request,
  ) {
    const parsedVersion = parseVersionOrThrow(version);
    return this.templatesService.restore(id, parsedVersion, getActor(request));
  }

  @Get(":id/export")
  @ApiOperation({ summary: "Scarica il template come file .md" })
  @ApiParam({ name: "id", description: "UUID template" })
  async exportMd(@Param("id") id: string, @Res() response: Response) {
    const template = await this.templatesService.findOne(id);
    if (!template) {
      throw makeError("Template non trovato", 404);
    }

    const safeName = template.name.replace(/[^a-z0-9_-]/gi, "_");
    response.setHeader("Content-Type", "text/markdown; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}_v${template.version}.md"`,
    );
    response.send(this.templatesService.getExportContent(template));
  }

  @Delete(":id")
  @ApiOperation({ summary: "Elimina template" })
  @ApiParam({ name: "id", description: "UUID template" })
  remove(@Param("id") id: string, @Req() request: Request) {
    return this.templatesService.delete(id, getActor(request));
  }
}
