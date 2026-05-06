import { Injectable, Logger } from "@nestjs/common";
import type { AuditRepository } from "../repository/audit.repository";

interface FindAuditOptions {
  entityType?: string;
  actor?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditRepository: AuditRepository) {}

  async log(
    entityType: string,
    entityId: string,
    action: string,
    actor = "system",
    metadata: Record<string, unknown> | null = null,
  ): Promise<void> {
    try {
      await this.auditRepository.insertLog(
        entityType,
        entityId,
        action,
        actor,
        metadata,
      );
    } catch (error) {
      this.logger.warn(
        `Audit log failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
  ) {
    return this.auditRepository.findByEntity(
      entityType,
      entityId,
      limit,
      offset,
    );
  }

  async findAll({
    entityType,
    actor,
    fromDate,
    toDate,
    limit = 50,
    offset = 0,
  }: FindAuditOptions = {}) {
    const { data, total } = await this.auditRepository.findAll({
      entityType,
      actor,
      fromDate,
      toDate,
      limit,
      offset,
    });

    return { data, total, limit, offset };
  }
}
