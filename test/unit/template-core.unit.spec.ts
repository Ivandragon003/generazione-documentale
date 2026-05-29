import { MockAiProvider } from "../../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../../src/service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "../../src/service/ai-template-auditor.service";
import { TemplateAuditService } from "../../src/service/template-audit.service";
import { TemplatePlaceholderService } from "../../src/service/template-placeholder.service";

describe("Unit - template core", () => {
  const placeholderService = new TemplatePlaceholderService();

  it("parses typed placeholders", () => {
    const parsed = placeholderService.parse("Cliente: {{string:nome_cliente}}");
    expect(parsed.errors).toEqual([]);
    expect(parsed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "nome_cliente", type: "string" }),
      ]),
    );
  });

  it("validates field types deterministically", () => {
    const result = placeholderService.validateFieldValues(
      "Data: {{date:data_stipula}}",
      { data_stipula: "not-a-date" },
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("data_stipula");
  });

  it("renders markdown with deterministic formatting", () => {
    const rendered = placeholderService.render(
      "Totale: {{currency:totale}}\nAttivo: {{boolean:attivo}}",
      { totale: 1234.5, attivo: true },
      false,
    );
    expect(rendered.unresolved).toEqual([]);
    expect(rendered.result).toContain("Totale: 1,234.5");
    expect(rendered.result).toContain("Attivo: Yes");
  });

  it("does not call AI semantic review with syntax blocking errors", async () => {
    const auditTemplate = jest.fn();
    const service = new TemplateAuditService(placeholderService, {
      auditTemplate,
    } as unknown as AiTemplateAuditorService);
    const report = await service.audit({
      content: "Cliente: {{string:nome_cliente",
      runAi: true,
    });
    expect(report.deterministic.errors.length).toBeGreaterThan(0);
    expect(auditTemplate).not.toHaveBeenCalled();
    expect(report.ai?.provider).toBe("skipped");
  });

  it("uses AI stub only when syntax is valid", async () => {
    process.env.AI_PROVIDER = "mock";
    const service = new TemplateAuditService(
      placeholderService,
      new AiTemplateAuditorService(
        new MockAiProvider(),
        new OllamaAiProvider(),
      ),
    );
    const report = await service.audit({
      content: "Data di nascita: {{string:data_nascita}}",
      runAi: true,
    });
    expect(report.deterministic.errors).toEqual([]);
    expect(report.ai?.warnings.length ?? 0).toBeGreaterThanOrEqual(0);
  });
});
