import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

describe("Ai template draft providers", () => {
  it("MockAiProvider generates markdown using supported parser syntax only", async () => {
    const provider = new MockAiProvider();
    const placeholderService = new TemplatePlaceholderService();

    const result = await provider.generateTemplateDraft({
      description: "Verbale riunione con data, partecipanti e decisioni",
      language: "it",
      syntaxProfile: placeholderService.describeTemplateSyntaxProfile(),
    });

    const parsed = placeholderService.parse(result.markdown);
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields.length).toBeGreaterThan(0);
  });
});
