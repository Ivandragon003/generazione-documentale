import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import type { FieldType } from "../common/types/field-definition.type";

const fieldTypes: FieldType[] = ["text", "number", "date", "boolean"];

export class TemplateFieldDto {
  @ApiProperty({ example: "titolo" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "Titolo" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: fieldTypes, example: "text" })
  @IsOptional()
  @IsEnum(fieldTypes)
  type?: FieldType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ example: "" })
  @IsOptional()
  @IsString()
  defaultValue?: string;
}
