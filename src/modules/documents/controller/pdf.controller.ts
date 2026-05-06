import { Controller, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { makeError } from "../../../common/utils/errors";
import type { TemplatesService } from "../../templates/service/templates.service";

@ApiTags("pdf")
@Controller("pdf")
export class PdfController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post("templates/:templateId/validate")
  @ApiOperation({
    summary: "Valida disponibilita template per generazione PDF",
  })
  @ApiParam({ name: "templateId", description: "UUID template" })
  @ApiResponse({ status: 200, description: "Stato disponibilita template" })
  @ApiResponse({ status: 404, description: "Template non trovato" })
  async validateTemplate(@Param("templateId") templateId: string) {
    const template = await this.templatesService.findOne(templateId);
    if (!template) {
      throw makeError("Template non trovato", 404);
    }

    const isAvailable =
      template.status === "published" || template.status === "draft";

    return {
      templateId: template.id,
      valid: isAvailable,
      available: isAvailable,
      status: template.status,
      version: template.version,
      fields: template.fields ?? [],
    };
  }
}
