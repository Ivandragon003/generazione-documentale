import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { TemplateFieldDto } from "./template-field.dto";

export class CreateTemplateDto {
  @ApiProperty({ example: "Template Contratto" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "Template base per contratti" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "# {{titolo}}\n\nCliente: {{cliente}}" })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ type: () => [TemplateFieldDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields?: TemplateFieldDto[];
}
