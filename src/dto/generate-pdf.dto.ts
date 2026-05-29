import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  Allow,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type { FieldValueMap } from "../service/document-rendering.service";

export class GeneratePdfDto {
  @ApiPropertyOptional({
    description: "Field values used for placeholder substitution",
    example: {
      customer_name: "Acme Inc",
      amount: 5000,
      rows: [{ description: "Service", quantity: 2, price: 100 }],
    },
    required: false,
  })
  @Allow()
  @IsOptional()
  @IsObject()
  fieldValues?: FieldValueMap;

  @ApiPropertyOptional({
    description:
      "Browser language used to choose the document script/font profile",
    example: "en-US",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(35)
  language?: string;
}
