import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThanOrEqual, type Repository } from "typeorm";
import { PdfJobEntity } from "../entities/pdf-job.entity";
import type { FieldValueMap } from "../service/document-rendering.service";

@Injectable()
export class PdfJobsRepository {
  constructor(
    @InjectRepository(PdfJobEntity)
    private readonly repo: Repository<PdfJobEntity>,
  ) {}

  async insert(
    templateId: string,
    fieldValues: FieldValueMap,
    actor: string,
    templateContentHash: string,
    fieldValuesHash: string,
  ): Promise<PdfJobEntity> {
    const job = this.repo.create({
      template_id: templateId,
      field_values: fieldValues,
      requested_by: actor,
      status: "queued",
      template_content_hash: templateContentHash,
      field_values_hash: fieldValuesHash,
    });
    return this.repo.save(job);
  }

  async findById(id: string): Promise<PdfJobEntity | null> {
    return this.repo.findOneBy({ id });
  }

  async findByTemplate(templateId: string): Promise<PdfJobEntity[]> {
    return this.repo.find({
      where: { template_id: templateId },
      order: { created_at: "DESC" },
    });
  }

  async findQueued(): Promise<PdfJobEntity[]> {
    return this.repo.find({
      where: { status: "queued" },
      order: { created_at: "ASC" },
    });
  }

  async findLatestCompleted(
    templateId: string,
    templateContentHash: string,
    fieldValuesHash: string,
  ): Promise<PdfJobEntity | null> {
    return this.repo.findOne({
      where: {
        template_id: templateId,
        status: "completed",
        template_content_hash: templateContentHash,
        field_values_hash: fieldValuesHash,
      },
      order: { completed_at: "DESC" },
    });
  }

  async claim(jobId: string): Promise<boolean> {
    const result = await this.repo
      .createQueryBuilder()
      .update(PdfJobEntity)
      .set({ status: "running", started_at: new Date() })
      .where("id = :id AND status = 'queued'", { id: jobId })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  async markCompleted(
    jobId: string,
    filename: string,
    unresolvedFields: string[],
    templateContentHash: string,
    renderedContentHash: string,
  ): Promise<void> {
    await this.repo.update(jobId, {
      status: "completed",
      filename,
      unresolved_fields: unresolvedFields,
      template_content_hash: templateContentHash,
      rendered_content_hash: renderedContentHash,
      completed_at: new Date(),
    });
  }

  async markFailed(jobId: string, errorMessage: string): Promise<void> {
    await this.repo.update(jobId, {
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date(),
    });
  }

  async findCompletedBefore(cutoff: Date): Promise<PdfJobEntity[]> {
    return this.repo.find({
      where: {
        status: "completed",
        completed_at: LessThanOrEqual(cutoff),
      },
      order: { completed_at: "ASC" },
    });
  }

  async findFailedBefore(cutoff: Date): Promise<PdfJobEntity[]> {
    return this.repo.find({
      where: {
        status: "failed",
        completed_at: LessThanOrEqual(cutoff),
      },
      order: { completed_at: "ASC" },
    });
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.repo.delete(ids);
    return result.affected ?? 0;
  }
}
