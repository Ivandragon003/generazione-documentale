import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class ValidateMarkdownDto {
  @ApiProperty({ example: "# {{titolo}}\n\nCliente: {{cliente}}" })
  @IsString()
  content!: string;
}
