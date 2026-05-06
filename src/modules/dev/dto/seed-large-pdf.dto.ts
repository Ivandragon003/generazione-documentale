import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class SeedLargePdfDto {
  @ApiPropertyOptional({ example: "http://localhost:3000" })
  @IsOptional()
  @IsString()
  baseUrl?: string;
}
