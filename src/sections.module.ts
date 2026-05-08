import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SectionsController } from "./controller/sections.controller";
import { SectionEntity } from "./entities/section.entity";
import { SectionsService } from "./service/sections.service";

@Module({
  imports: [TypeOrmModule.forFeature([SectionEntity])],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
