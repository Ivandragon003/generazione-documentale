import { Inject, Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { DataSource } from "typeorm";
import { makeError } from "../common/utils/errors";
import { assertUuid } from "../common/utils/http.utils";
import { DocumentsRepository } from "../repository/documents.repository";
import { PdfJobsService } from "./pdf-jobs.service";
import { TemplatesService } from "./templates.service";

export interface CreateDocumentInput {
  name: string;
  templateId: string;
  created_by?: string;
}

export interface UpdateDocumentInput {
  name?: string;
  content?: string;
  fieldValues?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(DocumentsRepository)
    private readonly documentsRepository: DocumentsRepository,
    @Inject(TemplatesService)
    private readonly templatesService: TemplatesService,
    @Inject(PdfJobsService)
    private readonly pdfJobsService: PdfJobsService,
  ) {}

  private async findOneOrThrow(id: string) {
    const document = await this.findOne(id);
    if (!document) throw makeError("Documento non trovato", 404);
    return document;
  }

  async findAll({
    status,
    limit = 20,
    offset = 0,
  }: {
    status?: "draft" | "generated" | "published" | "archived";
    limit?: number;
    offset?: number;
  }) {
    const { data, total } = await this.documentsRepository.findAll({
      status,
      limit,
      offset,
    });
    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    return this.documentsRepository.findById(id);
  }

  async create({
    name,
    templateId,
    created_by = "system",
  }: CreateDocumentInput) {
    if (!name || name.trim().length === 0) {
      throw makeError("Il nome documento e obbligatorio", 400);
    }
    assertUuid(templateId, "templateId");
    const template = await this.templatesService.findOne(templateId);
    if (!template) throw makeError("Template non trovato", 404);
    return this.dataSource.transaction(async (manager) =>
      this.documentsRepository.createDocument(manager, {
        name: name.trim(),
        templateId,
        content: template.content,
        fieldValues: {},
        createdBy: created_by,
      }),
    );
  }

  async update(
    id: string,
    { name, content, fieldValues }: UpdateDocumentInput,
  ) {
    const existing = await this.findOneOrThrow(id);
    return this.dataSource.transaction(async (manager) =>
      this.documentsRepository.updateDocument(manager, {
        id,
        name: name?.trim() ?? existing.name,
        content: content ?? existing.content,
        fieldValues: fieldValues ?? existing.field_values,
      }),
    );
  }

  async delete(id: string) {
    await this.findOneOrThrow(id);
    return this.documentsRepository.deleteDocument(id);
  }
}
