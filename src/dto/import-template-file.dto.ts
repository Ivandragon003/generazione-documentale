import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class ImportTemplateFileDto {
  @ApiPropertyOptional({
    description: "Nome del template (opzionale)",
    example: "Template importato",
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: "UUID sezione associata al template",
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;
}
