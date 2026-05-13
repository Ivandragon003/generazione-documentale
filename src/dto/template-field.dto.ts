import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import type { FieldType } from "../common/types/field-definition.type";
import { allowedFieldTypes } from "../common/utils/markdown.utils";

export class TemplateFieldOptionDto {
  @ApiProperty({ example: "Attivo" })
  @IsString()
  label!: string;

  @ApiProperty({ example: "active" })
  @IsString()
  value!: string;
}

export class TemplateFieldColumnDto {
  @ApiProperty({ example: "descrizione" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "Descrizione" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: allowedFieldTypes, example: "text" })
  @IsOptional()
  @IsEnum(allowedFieldTypes)
  type?: FieldType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ example: "Inserisci valore" })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ type: () => TemplateFieldOptionDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldOptionDto)
  options?: TemplateFieldOptionDto[];

  @ApiPropertyOptional({ type: () => TemplateFieldColumnDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldColumnDto)
  columns?: TemplateFieldColumnDto[];
}

export class TemplateFieldDto extends TemplateFieldColumnDto {}
