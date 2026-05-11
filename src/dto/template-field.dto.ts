import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import type { FieldType } from "../common/types/field-definition.type";

const fieldTypes: FieldType[] = [
  "text",      // input singola riga
  "textarea",  // testo multi-riga
  "number",    // numero
  "date",      // data (YYYY-MM-DD)
  "boolean",   // checkbox si/no
  "email",     // indirizzo email
  "url",       // link/URL
  "tel",       // numero di telefono
  "select",    // scelta da lista (opzioni in defaultValue separate da virgola)
  "currency",  // importo monetario (es. € 1.000,00)
];

export class TemplateFieldDto {
  @ApiProperty({ example: "titolo" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "Titolo" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({
    enum: fieldTypes,
    example: "text",
    description:
      "Tipo del campo. 'select': opzioni in defaultValue separate da virgola.",
  })
  @IsOptional()
  @IsEnum(fieldTypes)
  type?: FieldType;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({
    example: "",
    description:
      "Valore di default. Per type=select: lista opzioni separate da virgola (es. \"Attivo,In attesa,Chiuso\").",
  })
  @IsOptional()
  @IsString()
  defaultValue?: string;
}
