import { ApiProperty } from "@nestjs/swagger";

export class PaginationResponseDto<T> {
  @ApiProperty({ type: Number })
  total!: number;

  @ApiProperty({ type: Number })
  limit!: number;

  @ApiProperty({ type: Number })
  offset!: number;

  data!: T[];
}
