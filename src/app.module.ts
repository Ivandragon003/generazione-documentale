import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "./config/env.validation";
import { buildTypeOrmOptions } from "./config/typeorm.config";
import { HealthController } from "./controller/health.controller";
import { TemplatesController } from "./controller/templates.controller";
import { AuditLogEntity } from "./entities/audit-log.entity";
import { PdfJobEntity } from "./entities/pdf-job.entity";
import { TemplateFieldListEntity } from "./entities/template-field-list.entity";
import { PdfJobsRepository } from "./repository/pdf-jobs.repository";
import { MockAiProvider } from "./service/ai/mock-ai.provider";
import { OllamaAiProvider } from "./service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "./service/ai-template-auditor.service";
import { AuditLogsService } from "./service/audit-logs.service";
import { DocumentRenderingService } from "./service/document-rendering.service";
import { GitTemplateVersioningService } from "./service/git-template-versioning.service";
import { GitHubStorageService } from "./service/github-storage.service";
import { PdfGenerationService } from "./service/pdf-generation.service";
import { PdfJobsService } from "./service/pdf-jobs.service";
import { TemplateAuditService } from "./service/template-audit.service";
import { TemplateDraftGenerationService } from "./service/template-draft-generation.service";
import { TemplateFieldListsService } from "./service/template-field-lists.service";
import { TemplatePlaceholderService } from "./service/template-placeholder.service";
import { TemplateStorageService } from "./service/template-storage.service";
import { TemplatesService } from "./service/templates.service";
import {
  DemoTenantProvider,
  TenantProvider,
} from "./service/tenant-provider.service";

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
    TypeOrmModule.forFeature([
      PdfJobEntity,
      TemplateFieldListEntity,
      AuditLogEntity,
    ]),
  ],
  controllers: [HealthController, TemplatesController],
  providers: [
    GitHubStorageService,
    TemplateStorageService,
    GitTemplateVersioningService,
    TemplatesService,
    { provide: TenantProvider, useClass: DemoTenantProvider },
    TemplatePlaceholderService,
    MockAiProvider,
    OllamaAiProvider,
    AiTemplateAuditorService,
    TemplateAuditService,
    TemplateDraftGenerationService,
    TemplateFieldListsService,
    AuditLogsService,
    PdfJobsRepository,
    DocumentRenderingService,
    PdfGenerationService,
    PdfJobsService,
  ],
})
export class AppModule {}
