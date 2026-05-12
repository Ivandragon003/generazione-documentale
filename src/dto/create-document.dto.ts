import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, IsUUID } from "class-validator";

export class CreateDocumentDto {
  @ApiProperty({ example: "Capitolato Beta" })
  @IsString()
  name!: string;

  @ApiProperty({
    format: "uuid",
    description: "ID template esistente",
  })
  @IsUUID()
  @Transform(({ value }) => value)
  templateId!: string;
}
