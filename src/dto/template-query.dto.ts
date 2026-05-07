import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../common/dto/pagination-query.dto";

export class TemplateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ["draft", "published"] })
  @IsOptional()
  @IsIn(["draft", "published"])
  status?: "draft" | "published";

  @ApiPropertyOptional({
    format: "uuid",
    description: "Filtra per ID sezione",
  })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Filtra per ID categoria",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
