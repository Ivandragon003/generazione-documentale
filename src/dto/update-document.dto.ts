import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class UpdateDocumentDto {
  @ApiPropertyOptional({ example: "Documento aggiornato" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "# Nuovo contenuto" })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: "Mappa chiave-valore dei campi template",
    example: { titolo: "Contratto", cliente: "Mario Rossi", importo: "1000" },
  })
  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, string | number | boolean | null>;
}
