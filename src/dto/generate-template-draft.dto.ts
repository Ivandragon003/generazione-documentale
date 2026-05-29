import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from "class-validator";

export class GenerateTemplateDraftDto {
  @ApiProperty({
    description: "Natural language description of the document template",
    example:
      "Contratto di fornitura con dati cliente, data stipula, importo e durata",
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @ApiPropertyOptional({
    description: "Preferred output language for labels and sections",
    example: "it",
    maxLength: 16,
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;

  @ApiPropertyOptional({
    description:
      "Run semantic AI audit after deterministic validation of the draft",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  runSemanticAudit?: boolean;

  @ApiPropertyOptional({
    description:
      "Prompt mode: free excludes parser grammar, guided includes parser grammar",
    enum: ["free", "guided"],
    default: "guided",
  })
  @IsOptional()
  @IsString()
  @IsIn(["free", "guided"])
  generationMode?: "free" | "guided";

  @ApiPropertyOptional({
    description: "Enable deterministic auto-repair for safe syntax fixes",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoRepair?: boolean;

  @ApiPropertyOptional({
    description: "Fallback length used by auto-repair when length is invalid",
    default: 120,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  defaultLength?: number;
}
