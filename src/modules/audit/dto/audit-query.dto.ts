import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: "template" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ example: "system" })
  @IsOptional()
  @IsString()
  actor?: string;

  @ApiPropertyOptional({ example: "2026-01-01T00:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: "2026-12-31T23:59:59.999Z" })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
