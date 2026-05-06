import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLogEntity } from "../../../entities/audit-log.entity";
import { AuditRepository } from "../repository/audit.repository";
import { AuditService } from "../service/audit.service";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
