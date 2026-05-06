import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { buildTypeOrmOptions } from "./database/typeorm.config";
import { DevModule } from "./modules/dev/module/dev.module";
import { DocumentsModule } from "./modules/documents/module/documents.module";
import { HealthModule } from "./modules/health/module/health.module";
import { TemplatesModule } from "./modules/templates/module/templates.module";

@Module({
  imports: [
    TypeOrmModule.forRoot(buildTypeOrmOptions()),
    HealthModule,
    TemplatesModule,
    DocumentsModule,
    DevModule,
  ],
})
export class AppModule {}
