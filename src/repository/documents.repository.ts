import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";
import { DocumentEntity } from "../entities/document.entity";
import { PdfJobEntity } from "../entities/pdf-job.entity";

interface FindAllOptions {
  status?: "draft" | "generated" | "published" | "archived";
  limit: number;
  offset: number;
}

interface InsertDocumentPayload {
  name: string;
  templateId: string;
  content: string;
  createdBy: string;
}

@Injectable()
export class DocumentsRepository {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documentRepository: Repository<DocumentEntity>,
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
      content: payload.content,
      field_values: {},
      status: "draft",
      created_by: payload.createdBy,
    });
    return manager.save(DocumentEntity, document);
  }

  async updateDocument(
    manager: EntityManager,
    payload: {
      id: string;
      name: string;
      content: string;
      fieldValues: Record<string, string | number | boolean | null>;
    },
  ): Promise<DocumentEntity> {
    const document = await manager.findOne(DocumentEntity, {
      where: { id: payload.id },
    });
    if (!document) throw new Error("Documento non trovato dopo update");

    document.name = payload.name;
    document.content = payload.content;
    document.field_values = payload.fieldValues;

    return manager.save(DocumentEntity, document);
  }

  async insertPdfJob(
    documentId: string,
    requestedBy: string,
  ): Promise<PdfJobEntity> {
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

  async findPdfJob(
    documentId: string,
    jobId: string,
  ): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({
      where: { id: jobId, document_id: documentId },
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

  async claimQueuedPdfJob(jobId: string): Promise<boolean> {
    const result = await this.pdfJobRepository
      .createQueryBuilder()
      .update(PdfJobEntity)
      .set({ status: "running", started_at: new Date() })
      .where("id = :jobId", { jobId })
      .andWhere("status = :status", { status: "queued" })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async findLatestCompletedPdfJob(
    documentId: string,
  ): Promise<PdfJobEntity | null> {
    return this.pdfJobRepository.findOne({
      where: { document_id: documentId, status: "completed" },
      order: { created_at: "DESC" },
    });
  }

  async updatePdfJobCompleted(
    jobId: string,
    filename: string,
    unresolvedFields: string[],
  ): Promise<void> {
    await this.pdfJobRepository.update(
      { id: jobId },
      {
        status: "completed",
        filename,
        unresolved_fields: unresolvedFields,
        completed_at: new Date(),
      },
    );
  }

  async updatePdfJobFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.pdfJobRepository.update(
      { id: jobId },
      {
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date(),
      },
    );
  }

  async updateDocumentStatusGenerated(documentId: string): Promise<void> {
    await this.documentRepository.update(
      { id: documentId },
      { status: "generated" },
    );
  }

  async deleteDocument(id: string): Promise<void> {
    await this.documentRepository.delete({ id });
  }
}
