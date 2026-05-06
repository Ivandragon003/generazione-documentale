import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentEntity } from "../../../entities/document.entity";
import { TemplateEntity } from "../../../entities/template.entity";
import { TemplateVersionEntity } from "../../../entities/template-version.entity";
import { AuditModule } from "../../audit/module/audit.module";
import { TemplatesController } from "../controller/templates.controller";
import { TemplatesRepository } from "../repository/templates.repository";
import { TemplatesService } from "../service/templates.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TemplateEntity,
      TemplateVersionEntity,
      DocumentEntity,
    ]),
    AuditModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesRepository, TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
