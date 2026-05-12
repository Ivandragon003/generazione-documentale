import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "./config/env.validation";
import { buildTypeOrmOptions } from "./config/typeorm.config";
import { DocumentsController } from "./controller/documents.controller";
import { HealthController } from "./controller/health.controller";
import { TemplatesController } from "./controller/templates.controller";
import { DocumentEntity } from "./entities/document.entity";
import { PdfJobEntity } from "./entities/pdf-job.entity";
import { TemplateEntity } from "./entities/template.entity";
import { DocumentsRepository } from "./repository/documents.repository";
import { TemplatesRepository } from "./repository/templates.repository";
import { DocumentEventsService } from "./service/document-events.service";
import { DocumentRenderingService } from "./service/document-rendering.service";
import { DocumentsService } from "./service/documents.service";
import { GitHubStorageService } from "./service/github-storage.service";
import { PdfGenerationService } from "./service/pdf-generation.service";
import { PdfJobsService } from "./service/pdf-jobs.service";
import { PreviewService } from "./service/preview.service";
import { TemplatesService } from "./service/templates.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmOptions(configService),
    }),
    TypeOrmModule.forFeature([TemplateEntity, DocumentEntity, PdfJobEntity]),
  ],
  controllers: [HealthController, TemplatesController, DocumentsController],
  providers: [
    // Storage
    GitHubStorageService,
    // Templates
    TemplatesRepository,
    TemplatesService,
    // Documents
    DocumentsRepository,
    DocumentsService,
    PreviewService,
    // PDF
    DocumentEventsService,
    DocumentRenderingService,
    PdfGenerationService,
    PdfJobsService,
  ],
})
export class AppModule {}
