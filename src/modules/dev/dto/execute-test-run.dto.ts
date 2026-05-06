import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ExecuteTestRunDto {
  @ApiPropertyOptional({ example: "api-regression" })
  @IsOptional()
  @IsString()
  suite?: string;

  @ApiPropertyOptional({ example: "http://localhost:3000" })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  reset?: boolean;
}
