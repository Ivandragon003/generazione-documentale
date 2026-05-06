import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { buildTypeOrmOptions } from "./database/typeorm.config";
import { DocumentEntity } from "./entities/document.entity";
import { DocumentVersionEntity } from "./entities/document-version.entity";
import { PdfJobEntity } from "./entities/pdf-job.entity";
import { TemplateEntity } from "./entities/template.entity";
import { TemplateVersionEntity } from "./entities/template-version.entity";
import { DocumentsController } from "./controller/documents.controller";
import { HealthController } from "./controller/health.controller";
import { TemplatesController } from "./controller/templates.controller";
import { DocumentsRepository } from "./repository/documents.repository";
import { TemplatesRepository } from "./repository/templates.repository";
import { DocumentsService } from "./service/documents.service";
import { GithubService } from "./service/github.service";
import { TemplatesService } from "./service/templates.service";

@Module({
  imports: [
    TypeOrmModule.forRoot(buildTypeOrmOptions()),
    TypeOrmModule.forFeature([
      TemplateEntity,
      TemplateVersionEntity,
      DocumentEntity,
      DocumentVersionEntity,
      PdfJobEntity,
    ]),
  ],
  controllers: [HealthController, TemplatesController, DocumentsController],
  providers: [
    TemplatesRepository,
    TemplatesService,
    DocumentsRepository,
    DocumentsService,
    GithubService,
  ],
})
export class AppModule {}
