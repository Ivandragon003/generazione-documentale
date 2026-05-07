import { ApiProperty } from "@nestjs/swagger";
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
  templateId!: string;
}
