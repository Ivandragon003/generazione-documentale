import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : Number.parseInt(String(value), 10),
  )
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : Number.parseInt(String(value), 10),
  )
  @IsInt()
  @Min(0)
  offset?: number;
}
