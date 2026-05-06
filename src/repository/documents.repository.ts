import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import { DocumentEntity } from "../entities/document.entity";
import { DocumentVersionEntity } from "../entities/document-version.entity";
import { PdfJobEntity } from "../entities/pdf-job.entity";

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

  async findAll({ status, limit, offset }: FindAllOptions): Promise<{ data: DocumentEntity[]; total: number }> {
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

  async insertDocument(manager: EntityManager, payload: InsertDocumentPayload): Promise<DocumentEntity> {
    const document = manager.create(DocumentEntity, {
      name: payload.name,
      template_id: payload.templateId,
      template_version: payload.templateVersion,
      content: payload.content,
      field_values: {},
      version: 1,
      status: "draft",
      created_by: payload.createdBy,
      updated_by: payload.createdBy,
    });
    return manager.save(DocumentEntity, document);
  }

  async insertDocumentVersion(manager: EntityManager, payload: InsertDocumentVersionPayload): Promise<DocumentVersionEntity> {
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
    payload: { id: string; name: string; content: string; fieldValues: Record<string, string | number | boolean | null>; version: number },
  ): Promise<DocumentEntity> {
    await manager.update(DocumentEntity, { id: payload.id }, {
      name: payload.name,
      content: payload.content,
      field_values: payload.fieldValues,
      version: payload.version,
    });
    const updated = await manager.findOne(DocumentEntity, { where: { id: payload.id } });
    if (!updated) throw new Error("Documento non trovato dopo update");
    return updated;
  }

  async getMaxVersion(documentId: string): Promise<number> {
    const result = await this.documentVersionRepository
      .createQueryBuilder("dv")
      .select("MAX(dv.version)", "max")
      .where("dv.document_id = :documentId", { documentId })
      .getRawOne<{ max: number | null }>();
    return result?.max ?? 0;
  }

  async findVersions(documentId: string): Promise<DocumentVersionEntity[]> {
    return this.documentVersionRepository.find({
      where: { document_id: documentId },
      order: { version: "DESC" },
    });
  }

  async findVersionById(documentId: string, version: number): Promise<DocumentVersionEntity | null> {
    return this.documentVersionRepository.findOne({
      where: { document_id: documentId, version },
    });
  }

  async insertPdfJob(documentId: string, requestedBy: string): Promise<PdfJobEntity> {
    const job = this.pdfJobRepository.create({
      document_id: documentId,
      status: "queued",
      requested_by: requestedBy,
    });
    return this.pdfJobRepository.save(job);
  }

  async findPdfJobById(jobId: string): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({ where: { id: jobId } });
  }

  async findPdfJob(documentId: string, jobId: string): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({ where: { id: jobId, document_id: documentId } });
  }

  async findPdfJobsByDocument(documentId: string): Promise<PdfJobEntity[]> {
    return this.pdfJobRepository.find({
      where: { document_id: documentId },
      order: { created_at: "DESC" },
    });
  }

  async findQueuedPdfJobs(): Promise<PdfJobEntity[]> {
    return this.pdfJobRepository.find({ where: { status: "queued" } });
  }

  async findLatestCompletedPdfJob(documentId: string): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({
      where: { document_id: documentId, status: "completed" },
      order: { created_at: "DESC" },
    });
  }

  async updatePdfJobRunning(jobId: string): Promise<void> {
    await this.pdfJobRepository.update({ id: jobId }, { status: "running", started_at: new Date() });
  }

  async updatePdfJobCompleted(jobId: string, filename: string, unresolvedFields: string[]): Promise<void> {
    await this.pdfJobRepository.update({ id: jobId }, {
      status: "completed",
      filename,
      unresolved_fields: unresolvedFields,
      completed_at: new Date(),
    });
  }

  async updatePdfJobFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.pdfJobRepository.update({ id: jobId }, {
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date(),
    });
  }

  async updateDocumentStatusGenerated(documentId: string): Promise<void> {
    await this.documentRepository.update({ id: documentId }, { status: "generated" });
  }

  async deleteDocument(id: string): Promise<void> {
    await this.documentRepository.delete({ id });
  }
}
