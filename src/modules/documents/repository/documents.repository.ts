import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import { DocumentEntity } from "../../../entities/document.entity";
import { DocumentVersionEntity } from "../../../entities/document-version.entity";
import { PdfJobEntity } from "../../../entities/pdf-job.entity";

interface FindAllOptions {
  status?: "draft" | "generated" | "published" | "archived";
  limit: number;
  offset: number;
}

interface InsertDocumentPayload {
  name: string;
  templateId: string;
  templateVersion: number;
  content: string;
  createdBy: string;
}

interface InsertDocumentVersionPayload {
  documentId: string;
  version: number;
  content: string;
  fieldValues: Record<string, string | number | boolean | null>;
  action: string;
  createdBy: string;
}

@Injectable()
export class DocumentsRepository {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
    @InjectRepository(DocumentVersionEntity)
    private readonly documentVersionRepository: Repository<DocumentVersionEntity>,
    @InjectRepository(PdfJobEntity)
    private readonly pdfJobRepository: Repository<PdfJobEntity>,
  ) {}

  async findAll({
    status,
    limit,
    offset,
  }: FindAllOptions): Promise<{ data: DocumentEntity[]; total: number }> {
    const where = status ? { status } : {};
    const [data, total] = await this.documentRepository.findAndCount({
      where,
      order: { updated_at: "DESC" },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }

  async findById(id: string): Promise<DocumentEntity | null> {
    return this.documentRepository.findOne({ where: { id } });
  }

  async insertDocument(
    manager: EntityManager,
    payload: InsertDocumentPayload,
  ): Promise<DocumentEntity> {
    const document = manager.create(DocumentEntity, {
      name: payload.name,
      template_id: payload.templateId,
      template_version: payload.templateVersion,
      content: payload.content,
      created_by: payload.createdBy,
      field_values: {},
    });
    return manager.save(DocumentEntity, document);
  }

  async insertDocumentVersion(
    manager: EntityManager,
    payload: InsertDocumentVersionPayload,
  ): Promise<DocumentVersionEntity> {
    const version = manager.create(DocumentVersionEntity, {
      document_id: payload.documentId,
      version: payload.version,
      content: payload.content,
      field_values: payload.fieldValues,
      action: payload.action,
      created_by: payload.createdBy,
    });

    return manager.save(DocumentVersionEntity, version);
  }

  async updateDocument(
    manager: EntityManager,
    {
      id,
      name,
      content,
      fieldValues,
      version,
    }: {
      id: string;
      name: string;
      content: string;
      fieldValues: Record<string, string | number | boolean | null>;
      version: number;
    },
  ): Promise<DocumentEntity> {
    await manager.update(
      DocumentEntity,
      { id },
      {
        name,
        content,
        field_values: fieldValues,
        version,
      },
    );

    const document = await manager.findOne(DocumentEntity, { where: { id } });
    if (!document) {
      throw new Error("Documento aggiornato non trovato");
    }

    return document;
  }

  async getMaxVersion(id: string): Promise<number> {
    const row = await this.documentVersionRepository
      .createQueryBuilder("version")
      .select("COALESCE(MAX(version.version), 0)", "max")
      .where("version.document_id = :id", { id })
      .getRawOne<{ max: string }>();

    return Number.parseInt(row?.max ?? "0", 10);
  }

  async restoreDocument(
    manager: EntityManager,
    {
      id,
      content,
      fieldValues,
      version,
    }: {
      id: string;
      content: string;
      fieldValues: Record<string, string | number | boolean | null>;
      version: number;
    },
  ): Promise<DocumentEntity> {
    await manager.update(
      DocumentEntity,
      { id },
      {
        content,
        field_values: fieldValues,
        version,
      },
    );

    const document = await manager.findOne(DocumentEntity, { where: { id } });
    if (!document) {
      throw new Error("Documento ripristinato non trovato");
    }

    return document;
  }

  async findVersionById(
    id: string,
    version: number,
  ): Promise<DocumentVersionEntity | null> {
    return this.documentVersionRepository.findOne({
      where: { document_id: id, version },
    });
  }

  async findVersions(id: string): Promise<DocumentVersionEntity[]> {
    return this.documentVersionRepository.find({
      where: { document_id: id },
      order: { version: "DESC" },
    });
  }

  async deleteDocument(id: string): Promise<boolean> {
    const deleted = await this.documentRepository.delete({ id });
    return (deleted.affected ?? 0) > 0;
  }

  async insertPdfJob(
    documentId: string,
    actor = "system",
  ): Promise<PdfJobEntity> {
    const job = this.pdfJobRepository.create({
      document_id: documentId,
      requested_by: actor,
      created_by: actor,
      status: "queued",
    });

    return this.pdfJobRepository.save(job);
  }

  async findPdfJobById(id: string): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({ where: { id } });
  }

  async updatePdfJobRunning(id: string): Promise<void> {
    await this.pdfJobRepository.update(
      { id },
      { status: "running", started_at: new Date() },
    );
  }

  async updatePdfJobCompleted(
    id: string,
    filename: string,
    unresolvedFields: string[],
  ): Promise<void> {
    await this.pdfJobRepository.update(
      { id },
      {
        status: "completed",
        filename,
        unresolved_fields: unresolvedFields,
        completed_at: new Date(),
      },
    );
  }

  async updatePdfJobFailed(id: string, errorMessage: string): Promise<void> {
    await this.pdfJobRepository.update(
      { id },
      { status: "failed", error: errorMessage, completed_at: new Date() },
    );
  }

  async updateDocumentStatusGenerated(id: string): Promise<void> {
    await this.documentRepository.update({ id }, { status: "generated" });
  }

  async findPdfJob(
    documentId: string,
    jobId: string,
  ): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({
      where: { document_id: documentId, id: jobId },
    });
  }

  async findLatestCompletedPdfJob(
    documentId: string,
  ): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({
      where: { document_id: documentId, status: "completed" },
      order: { completed_at: "DESC" },
    });
  }

  async findPdfJobsByDocument(documentId: string): Promise<PdfJobEntity[]> {
    return this.pdfJobRepository.find({
      where: { document_id: documentId },
      order: { created_at: "DESC" },
    });
  }

  async findQueuedPdfJobs(): Promise<PdfJobEntity[]> {
    return this.pdfJobRepository.find({
      where: { status: "queued" },
      order: { created_at: "ASC" },
    });
  }
}
