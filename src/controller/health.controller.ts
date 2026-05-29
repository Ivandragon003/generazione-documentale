import { Controller, Get, HttpCode, HttpStatus, Inject } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { OllamaAiProvider } from "../service/ai/ollama-ai.provider";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(OllamaAiProvider)
    private readonly ollamaAiProvider: OllamaAiProvider,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Application health check" })
  @ApiResponse({
    status: 200,
    description: "Application is running",
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

  @Get("ollama")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Ollama connectivity check from backend runtime" })
  @ApiResponse({
    status: 200,
    description: "Ollama connectivity details",
  })
  async checkOllama(): Promise<{
    provider: "ollama";
    configured: {
      baseUrl: string;
      model: string;
      numPredict: number;
      temperature: number;
      keepAlive: string;
    };
    reachable: boolean;
    error?: string;
  }> {
    const config = this.ollamaAiProvider.getRuntimeConfig();
    const status = await this.ollamaAiProvider.healthCheck();
    return {
      provider: "ollama",
      configured: {
        baseUrl: config.baseUrl,
        model: config.model,
        numPredict: config.numPredict,
        temperature: config.temperature,
        keepAlive: config.keepAlive,
      },
      reachable: status.ok,
      ...(status.error ? { error: status.error } : {}),
    };
  }
}
