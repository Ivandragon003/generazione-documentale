import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "../src/service/ai-template-auditor.service";
import { TemplateAuditService } from "../src/service/template-audit.service";
import { TemplateDraftGenerationService } from "../src/service/template-draft-generation.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";

describe("TemplateDraftGenerationService compact quality helpers", () => {
  const buildService = () => {
    const placeholderService = new TemplatePlaceholderService();
    const auditService = new TemplateAuditService(
      placeholderService,
      new AiTemplateAuditorService(
        new MockAiProvider(),
        new OllamaAiProvider(),
      ),
    );
    return new TemplateDraftGenerationService(
      placeholderService,
      auditService,
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
  };

  it("converts placeholders to canonical extended form", () => {
    const service = buildService() as unknown as {
      enforceExtendedCanonicalPlaceholders: (markdown: string) => string;
    };
    const normalized = service.enforceExtendedCanonicalPlaceholders(
      [
        "Nome: {{string:nome_progetto}}",
        "Descrizione: {{text:descrizione_progetto}}",
        "Probabilità: {{percentage:probabilita_rischio_1}}",
      ].join("\n"),
    );
    expect(normalized).toContain("{{string:nome_progetto:120:true}}");
    expect(normalized).toContain("{{text:descrizione_progetto:400:true}}");
    expect(normalized).toContain("{{percentage:probabilita_rischio_1:5:true}}");
  });

  it("removes redundant 'Spiegazione descrittiva' subsection headings", () => {
    const service = buildService() as unknown as {
      removeRedundantDescriptiveSubsections: (markdown: string) => string;
    };
    const cleaned = service.removeRedundantDescriptiveSubsections(
      [
        "## Rischi iniziali",
        "### Spiegazione descrittiva",
        "Testo sezione.",
        "{{text:rischi_iniziali}}",
      ].join("\n"),
    );
    expect(cleaned).not.toContain("### Spiegazione descrittiva");
    expect(cleaned).toContain("## Rischi iniziali");
  });

  it("adds generic retry delta instructions for incomplete profile tables", () => {
    const service = buildService() as unknown as {
      buildRetryTableFixInstructions: (result: {
        deterministic: { errors: Array<{ code: string; message: string }> };
      }) => string[];
    };
    const instructions = service.buildRetryTableFixInstructions({
      deterministic: {
        errors: [
          {
            code: "MISSING_TABLE_COLUMNS",
            message:
              'Section "Sezione profilo" table missing required headers. Missing: Campo, Valore',
          },
        ],
      },
    });
    expect(instructions.join("\n")).toContain(
      "Correggi le tabelle con colonne mancanti",
    );
    expect(
      instructions.some((line) =>
        line.includes(
          'Section "Sezione profilo" table missing required headers. Missing: Campo, Valore',
        ),
      ),
    ).toBe(true);
    expect(instructions.join("\n")).not.toContain("Rischi iniziali");
  });
});
