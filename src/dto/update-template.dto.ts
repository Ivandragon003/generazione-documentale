import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateTemplateDto } from "./create-template.dto";

class MutableTemplateDto extends OmitType(CreateTemplateDto, [
  "path",
] as const) {}

export class UpdateTemplateDto extends PartialType(MutableTemplateDto) {}
