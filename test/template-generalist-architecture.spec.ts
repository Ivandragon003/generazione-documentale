import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { TemplateAuditService } from "../src/service/template-audit.service";
import { TemplateDraftGenerationService } from "../src/service/template-draft-generation.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

describe("Template pipeline generalist architecture", () => {
  it("has no document-type-specific completion function in generation service", () => {
    const source = readFileSync(
      join(process.cwd(), "src/service/template-draft-generation.service.ts"),
      "utf8",
    );
    expect(source).not.toContain("ensureCompleteProjectCharter");
    expect(source).not.toContain('intent.purpose === "project_charter"');
  });

  it("keeps prompt builder free from hardcoded document-specific standards", () => {
    const source = readFileSync(
      join(process.cwd(), "src/service/prompt/template-prompt.builder.ts"),
      "utf8",
    );
    expect(source).not.toContain("PMBOK_PMI");
    expect(source).toContain(
      'reference_standard=${blueprint?.referenceStandard ?? "none"}',
    );
  });

  it("keeps audit contamination rules profile-driven", () => {
    const source = readFileSync(
      join(process.cwd(), "src/service/template-audit.service.ts"),
      "utf8",
    );
    expect(source).not.toContain("const contaminationRules");
    expect(source).toContain("DOCUMENT_BLUEPRINTS[documentType]?.antiPatterns");
  });

  it("keeps retry table-fix instructions generic", () => {
    const source = readFileSync(
      join(process.cwd(), "src/service/template-draft-generation.service.ts"),
      "utf8",
    );
    expect(source).not.toContain(
      "Rigenera ESCLUSIVAMENTE la sezione 'Rischi iniziali'",
    );
  });

  it("completes draft by active profile without injecting another profile sections", async () => {
    class SparseReportProvider extends MockAiProvider {
      override async generateTemplateDraft() {
        return {
          markdown:
            "# Report economico\n\n## KPI principali\n{{string:kpi_1:120:true}}",
          model: "sparse-report",
          latencyMs: 1,
        };
      }
    }
    process.env.AI_PROVIDER = "mock";
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(placeholderService, {
      auditTemplate: jest.fn().mockResolvedValue({
        warnings: [],
        provider: "mock",
        model: "mock-semantic-rules-v1",
        latencyMs: 1,
      }),
    } as never);
    const service = new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new SparseReportProvider(),
      new OllamaAiProvider(),
    );
    const result = await service.generateDraft({
      description: "Genera un report economico sintetico.",
      language: "it",
      runSemanticAudit: false,
    });
    expect(result.content).toContain("## KPI principali");
    expect(result.content).toContain("## Ricavi");
    expect(result.content).not.toContain("## Dati polizza");
  });
});
