import { ApiProperty } from "@nestjs/swagger";
import { Allow, IsObject, IsOptional } from "class-validator";
import type { FieldValueMap } from "../service/document-rendering.service";

export class GeneratePdfDto {
  @ApiProperty({
    description: "Valori dei campi per la sostituzione dei placeholder",
    example: {
      nome_cliente: "Acme SpA",
      importo: 5000,
      righe: [{ descrizione: "Servizio", quantita: 2, prezzo: 100 }],
    },
    required: false,
  })
  @Allow()
  @IsOptional()
  @IsObject()
  fieldValues?: FieldValueMap;
}
