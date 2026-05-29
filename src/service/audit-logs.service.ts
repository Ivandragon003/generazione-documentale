import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, type Repository } from "typeorm";
import { makeError } from "../common/utils/errors";
import { appConfig } from "../config/app.config";
import { AuditLogEntity } from "../entities/audit-log.entity";

export interface RecordAuditLogInput {
  tenantUuid: string;
  eventType: string;
  actor?: string;
  templateId?: string | null;
  payload?: Record<string, unknown>;
}

export interface AuditRetentionOptions {
  tenantUuid?: string;
}

@Injectable()
export class AuditLogsService implements OnModuleDestroy {
  private readonly logger = new Logger(AuditLogsService.name);
  private retentionTimer: NodeJS.Timeout | null = null;
  private retentionRunning = false;

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {
    this.scheduleRetention();
  }

  onModuleDestroy(): void {
    if (this.retentionTimer) {
      clearTimeout(this.retentionTimer);
      this.retentionTimer = null;
    }
  }

  private scheduleRetention(): void {
    if (this.retentionTimer || !appConfig.auditLogRetentionDays) return;
    this.retentionTimer = setTimeout(() => {
      this.retentionTimer = null;
      this.runScheduledRetention().catch(() => undefined);
    }, appConfig.pdfRetentionRunEveryMs);
    this.retentionTimer.unref?.();
  }

  private async runScheduledRetention(): Promise<void> {
    if (this.retentionRunning) return;
    this.retentionRunning = true;
    try {
      const deleted = await this.cleanupRetentionSafe();
      if (deleted > 0) {
        this.logger.log(`Audit retention deleted logs: count=${deleted}`);
      }
    } finally {
      this.retentionRunning = false;
      this.scheduleRetention();
    }
  }

  async record(input: RecordAuditLogInput): Promise<void> {
    const tenantUuid = input.tenantUuid?.trim();
    const eventType = input.eventType?.trim();
    if (!tenantUuid) throw makeError("tenantUuid is required", 400);
    if (!eventType) throw makeError("eventType is required", 400);

    await this.repository.save(
      this.repository.create({
        tenant_uuid: tenantUuid,
        event_type: eventType,
        actor: input.actor?.trim() || "system",
        template_id: input.templateId?.trim() || null,
        payload: input.payload ?? {},
      }),
    );
  }

  async listByTenant(
    tenantUuid: string,
    templateId?: string,
    limit = 50,
    offset = 0,
  ): Promise<AuditLogEntity[]> {
    if (!tenantUuid?.trim()) throw makeError("tenantUuid is required", 400);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);
    const normalizedTemplateId = templateId?.trim();
    return this.repository.find({
      where: {
        tenant_uuid: tenantUuid.trim(),
        ...(normalizedTemplateId ? { template_id: normalizedTemplateId } : {}),
      },
      order: { created_at: "DESC" },
      take: safeLimit,
      skip: safeOffset,
    });
  }

  async recordSafe(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.record(input);
    } catch (error) {
      this.logger.warn(
        `Failed to persist audit log "${input.eventType}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async cleanupRetention(
    retentionDays: number | null = appConfig.auditLogRetentionDays,
    options: AuditRetentionOptions = {},
  ): Promise<number> {
    if (!retentionDays || retentionDays <= 0) return 0;

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const tenantUuid = options.tenantUuid?.trim();
    const criteria = {
      ...(tenantUuid ? { tenant_uuid: tenantUuid } : {}),
      created_at: LessThan(cutoff),
    };
    const result = await this.repository.delete(criteria);
    return result.affected ?? 0;
  }

  async cleanupRetentionSafe(
    retentionDays: number | null = appConfig.auditLogRetentionDays,
    options: AuditRetentionOptions = {},
  ): Promise<number> {
    try {
      return await this.cleanupRetention(retentionDays, options);
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup audit logs: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    }
  }
}
