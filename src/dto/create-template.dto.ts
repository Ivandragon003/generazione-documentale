import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { TemplateFieldDto } from "./template-field.dto";

export class CreateTemplateDto {
  @ApiProperty({ description: "Template name", maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ description: "Template Markdown content" })
  @IsNotEmpty()
  @IsString()
  content!: string;

  @ApiPropertyOptional({
    description: "Field definitions",
    type: () => TemplateFieldDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldDto)
  fields?: TemplateFieldDto[];

  @ApiPropertyOptional({
    description: "Optional GitHub path override",
  })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({
    description: "Tenant UUID",
    example: "11111111-1111-1111-1111-111111111111",
  })
  @IsOptional()
  @IsString()
  tenantUuid?: string;
}
