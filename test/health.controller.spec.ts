import "reflect-metadata";
import { HealthController } from "../src/controller/health.controller";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";

describe("HealthController", () => {
  it("emits OllamaAiProvider as the Nest injection token", () => {
    const dependencies =
      Reflect.getMetadata("design:paramtypes", HealthController) ?? [];

    expect(dependencies[0]).toBe(OllamaAiProvider);
  });
});
