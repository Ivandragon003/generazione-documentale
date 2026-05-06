import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class DocumentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ["draft", "generated", "published", "archived"],
  })
  @IsOptional()
  @IsIn(["draft", "generated", "published", "archived"])
  status?: "draft" | "generated" | "published" | "archived";
}
