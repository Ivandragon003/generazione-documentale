import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLogEntity } from "../../../database/entities/audit-log.entity";

interface FindAuditFilters {
  entityType?: string;
  actor?: string;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
}

@Injectable()
export class AuditRepository {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repository: Repository<AuditLogEntity>,
  ) {}

  async insertLog(
    entityType: string,
    entityId: string,
    action: string,
    actor: string,
    metadata: Record<string, unknown> | null,
  ): Promise<AuditLogEntity> {
    const auditLog = this.repository.create({
      entity_type: entityType,
      entity_id: entityId,
      action,
      actor,
      metadata,
    });
    return this.repository.save(auditLog);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    limit: number,
    offset: number,
  ): Promise<AuditLogEntity[]> {
    return this.repository.find({
      where: {
        entity_type: entityType,
        entity_id: entityId,
      },
      order: { created_at: "DESC" },
      take: limit,
      skip: offset,
    });
  }

  async findAll(
    filters: FindAuditFilters,
  ): Promise<{ data: AuditLogEntity[]; total: number }> {
    const builder = this.repository.createQueryBuilder("audit");

    if (filters.entityType) {
      builder.andWhere("audit.entity_type = :entityType", {
        entityType: filters.entityType,
      });
    }

    if (filters.actor) {
      builder.andWhere("audit.actor = :actor", { actor: filters.actor });
    }

    if (filters.fromDate) {
      builder.andWhere("audit.created_at >= :fromDate", {
        fromDate: new Date(filters.fromDate),
      });
    }

    if (filters.toDate) {
      builder.andWhere("audit.created_at <= :toDate", {
        toDate: new Date(filters.toDate),
      });
    }

    const [data, total] = await builder
      .orderBy("audit.created_at", "DESC")
      .take(filters.limit)
      .skip(filters.offset)
      .getManyAndCount();

    return { data, total };
  }
}
