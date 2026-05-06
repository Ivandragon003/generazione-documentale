import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentEntity } from "../../../entities/document.entity";
import { DocumentVersionEntity } from "../../../entities/document-version.entity";
import { PdfJobEntity } from "../../../entities/pdf-job.entity";
import { AuditModule } from "../../audit/module/audit.module";
import { TemplatesModule } from "../../templates/module/templates.module";
import { DocumentsController } from "../controller/documents.controller";
import { PdfController } from "../controller/pdf.controller";
import { DocumentsRepository } from "../repository/documents.repository";
import { DocumentsService } from "../service/documents.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentEntity,
      DocumentVersionEntity,
      PdfJobEntity,
    ]),
    AuditModule,
    TemplatesModule,
  ],
  controllers: [DocumentsController, PdfController],
  providers: [DocumentsRepository, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
