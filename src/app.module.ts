import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "./config/env.validation";
import { buildTypeOrmOptions } from "./config/typeorm.config";
import { HealthController } from "./controller/health.controller";
import { TemplatesController } from "./controller/templates.controller";
import { PdfJobEntity } from "./entities/pdf-job.entity";
import { TemplateEntity } from "./entities/template.entity";
import { PdfJobsRepository } from "./repository/pdf-jobs.repository";
import { TemplatesRepository } from "./repository/templates.repository";
import { DocumentRenderingService } from "./service/document-rendering.service";
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
    TypeOrmModule.forFeature([TemplateEntity, PdfJobEntity]),
  ],
  controllers: [HealthController, TemplatesController],
  providers: [
    // Storage
    GitHubStorageService,
    // Templates
    TemplatesRepository,
    TemplatesService,
    // PDF
    PdfJobsRepository,
    DocumentRenderingService,
    PdfGenerationService,
    PdfJobsService,
    PreviewService,
  ],
})
export class AppModule {}
