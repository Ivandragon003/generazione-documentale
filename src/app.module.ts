import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { validateEnv } from "./config/env.validation";
import { DocumentsController } from "./controller/documents.controller";
import { HealthController } from "./controller/health.controller";
import { TemplatesController } from "./controller/templates.controller";
import { CategoryEntity } from "./database/entities/category.entity";
import { DocumentEntity } from "./database/entities/document.entity";
import { PdfJobEntity } from "./database/entities/pdf-job.entity";
import { SectionEntity } from "./database/entities/section.entity";
import { TemplateEntity } from "./database/entities/template.entity";
import { buildTypeOrmOptions } from "./database/typeorm.config";
import { DocumentsRepository } from "./repository/documents.repository";
import { TemplatesRepository } from "./repository/templates.repository";
import { DocumentsService } from "./service/documents.service";
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
    TypeOrmModule.forFeature([
      CategoryEntity,
      SectionEntity,
      TemplateEntity,
      DocumentEntity,
      PdfJobEntity,
    ]),
  ],
  controllers: [HealthController, TemplatesController, DocumentsController],
  providers: [
    TemplatesRepository,
    TemplatesService,
    DocumentsRepository,
    DocumentsService,
  ],
})
export class AppModule {}
