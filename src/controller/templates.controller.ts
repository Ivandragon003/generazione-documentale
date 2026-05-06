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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { makeError } from "../common/utils/errors";
import {
  getActor,
  parsePagination,
  parseVersionOrThrow,
  readAndCleanupUpload,
} from "../common/utils/http.utils";
import { appConfig } from "../config/app.config";
import type { CreateTemplateDto } from "../dto/create-template.dto";
import { ImportTemplateFileDto } from "../dto/import-template-file.dto";
import type { TemplateQueryDto } from "../dto/template-query.dto";
import type { UpdateTemplateDto } from "../dto/update-template.dto";
import type { ValidateMarkdownDto } from "../dto/validate-markdown.dto";
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

@ApiTags("templates")
@Controller("templates")
export class TemplatesController {
  constructor(
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
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
    const v = parseVersionOrThrow(version);
    const result = await this.templatesService.getVersionContent(id, v);
    if (!result) {
      throw makeError("Versione non trovata", 404);
    }
    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Crea template" })
  create(@Body() body: CreateTemplateDto, @Req() request: Request) {
    return this.templatesService.create({
      name: body.name,
      description: body.description,
      content: body.content,
      fields: body.fields,
      created_by: getActor(request),
    });
  }

  @Put(":id")
  @ApiOperation({ summary: "Aggiorna template" })
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
  @ApiOperation({ summary: "Ripristina versione precedente" })
  @ApiParam({ name: "id", description: "UUID template" })
  @ApiParam({ name: "version", description: "Numero versione da ripristinare" })
  restore(
    @Param("id") id: string,
    @Param("version") version: string,
    @Req() request: Request,
  ) {
    const v = parseVersionOrThrow(version);
    return this.templatesService.restore(id, v, getActor(request));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina template" })
  @ApiParam({ name: "id", description: "UUID template" })
  delete(@Param("id") id: string) {
    return this.templatesService.delete(id);
  }

  @Get(":id/export")
  @ApiOperation({ summary: "Esporta template come file .md" })
  @ApiParam({ name: "id", description: "UUID template" })
  async export(@Param("id") id: string, @Res() response: Response) {
    const template = await this.templatesService.findOne(id);
    if (!template) {
      throw makeError("Template non trovato", 404);
    }
    const content = this.templatesService.getExportContent(template);
    response.setHeader("Content-Type", "text/markdown");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${template.name}.md"`,
    );
    response.send(content);
  }

  @Post("import")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file", multerOptions))
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: ImportTemplateFileDto })
  @ApiOperation({ summary: "Importa template da file .md" })
  async import(
    @UploadedFile() file: UploadedMarkdownFile,
    @Body() body: ImportTemplateFileDto,
    @Req() request: Request,
  ) {
    if (!file) {
      throw makeError("File non fornito", 400);
    }
    const content = await readAndCleanupUpload(file);
    const name = body.name || file.originalname.replace(/\.md$/i, "");
    return this.templatesService.importFromMarkdown(
      content,
      name,
      getActor(request),
    );
  }

  @Post("validate")
  @ApiOperation({ summary: "Valida contenuto Markdown" })
  validate(@Body() body: ValidateMarkdownDto) {
    return this.templatesService.validateMarkdown(body.content);
  }
}
