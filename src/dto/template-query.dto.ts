import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";

export class TemplateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ["draft", "published"] })
  @IsOptional()
  @IsIn(["draft", "published"])
  status?: "draft" | "published";

  @ApiPropertyOptional({ example: "123e4567-e89b-12d3-a456-426614174000" })
  @IsOptional()
  @IsString()
  sectionId?: string;

  @ApiPropertyOptional({ example: "123e4567-e89b-12d3-a456-426614174000" })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
