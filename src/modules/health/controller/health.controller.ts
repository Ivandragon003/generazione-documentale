import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller("health")
export class HealthController {
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
}
