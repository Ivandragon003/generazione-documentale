import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional } from "class-validator";

export class GeneratePdfDto {
  @ApiProperty({
    description: "Valori dei campi per la sostituzione dei placeholder",
    example: { nome_cliente: "Acme SpA", importo: "5000" },
    required: false,
  })
  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, string | number | boolean | null>;
}
