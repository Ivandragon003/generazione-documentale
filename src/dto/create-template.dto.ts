import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { TemplateFieldDto } from "./template-field.dto";

export class CreateTemplateDto {
  @ApiPropertyOptional({
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

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
