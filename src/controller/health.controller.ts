import { Controller, Get, HttpCode, HttpStatus, Inject } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { PdfGenerationService } from "../service/pdf-generation.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(PdfGenerationService)
    private readonly pdfGenerationService: PdfGenerationService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Health check applicazione" })
  @ApiResponse({
    status: 200,
    description: "Applicazione attiva",
    schema: {
      properties: {
        status: { type: "string", example: "ok" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  check(): { status: "ok"; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("pdf")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Health check servizio PDF/Pandoc" })
  async checkPdf() {
    const health = await this.pdfGenerationService.checkHealth();
    if (!health.ok) {
      return {
        status: "error",
        ...health,
        timestamp: new Date().toISOString(),
      };
    }
    return { status: "ok", ...health, timestamp: new Date().toISOString() };
  }
}
