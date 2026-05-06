import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class TemplateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ["draft", "published"] })
  @IsOptional()
  @IsIn(["draft", "published"])
  status?: "draft" | "published";
}
