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
}
