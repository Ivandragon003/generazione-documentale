import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import type { FieldType } from "../common/types/field-definition.type";
import { allowedFieldTypes } from "../common/utils/markdown.utils";

export class TemplateFieldOptionDto {
  @ApiProperty({ example: "Active" })
  @IsString()
  label!: string;

  @ApiProperty({ example: "active" })
  @IsString()
  value!: string;
}

export class TemplateFieldColumnDto {
  @ApiProperty({ example: "description" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "Description" })
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

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxLength?: number;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ example: "Enter value" })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ example: "contract_types" })
  @IsOptional()
  @IsString()
  listName?: string;

  @ApiPropertyOptional({ example: "Contract type" })
  @IsOptional()
  @IsString()
  listLabel?: string;

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
