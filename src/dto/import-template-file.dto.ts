import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

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
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  sectionId?: string;
}
