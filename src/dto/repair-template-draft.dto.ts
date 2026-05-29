import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from "class-validator";

export class RepairTemplateDraftDto {
  @ApiProperty({
    description: "Current markdown to repair safely",
    example:
      "{{string:unità_responsabile}}\n{{list:obiettivi:length:true:obiettivi}}",
  })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    description: "Preferred language for semantic post-audit",
    example: "it",
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({
    description: "Run semantic AI audit after deterministic validation",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  runSemanticAudit?: boolean;

  @ApiPropertyOptional({
    description: "Repair mode: guided includes parser grammar metadata",
    enum: ["free", "guided"],
    default: "guided",
  })
  @IsOptional()
  @IsString()
  @IsIn(["free", "guided"])
  generationMode?: "free" | "guided";

  @ApiPropertyOptional({
    description: "Fallback length when placeholder length is invalid",
    default: 100,
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  defaultLength?: number;
}
