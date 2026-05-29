import type {
  AiTemplateAuditInput,
  AiTemplateAuditResult,
} from "../src/service/ai/ai-provider.interface";
import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "../src/service/ai-template-auditor.service";
import type { ParsedTemplatePlaceholder } from "../src/service/template-placeholder.service";

describe("AI providers", () => {
  it("MockAiProvider suggests date for Data di nascita + string", async () => {
    const provider = new MockAiProvider();
    const result = await provider.analyzeTemplate({
      markdown: "Data di nascita: {{string:data_nascita}}",
      fields: [
        {
          fieldName: "data_nascita",
          currentType: "string",
          surroundingText: "Data di nascita",
          fullLine: "| Data di nascita | {{string:data_nascita}} |",
          allowedTypes: ["string", "date", "currency", "percentage", "boolean"],
        },
      ],
      allowedTypes: ["string", "date", "currency", "percentage", "boolean"],
    });

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        fieldName: "data_nascita",
        suggestedType: "date",
      }),
    );
  });

  it("MockAiProvider suggests currency for Importo totale + string", async () => {
    const provider = new MockAiProvider();
    const result = await provider.analyzeTemplate({
      markdown: "Importo totale: {{string:importo_totale}}",
      fields: [
        {
          fieldName: "importo_totale",
          currentType: "string",
          surroundingText: "Importo totale",
          fullLine: "| Importo totale | {{string:importo_totale}} |",
          allowedTypes: ["string", "currency"],
        },
      ],
      allowedTypes: ["string", "currency"],
    });

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        fieldName: "importo_totale",
        suggestedType: "currency",
      }),
    );
  });

  it("AiTemplateAuditorService handles invalid AI output", async () => {
    class BrokenProvider extends MockAiProvider {
      override async analyzeTemplate(
        _input: AiTemplateAuditInput,
      ): Promise<AiTemplateAuditResult> {
        throw new Error("invalid json");
      }
    }

    process.env.AI_PROVIDER = "mock";
    const service = new AiTemplateAuditorService(
      new BrokenProvider(),
      new OllamaAiProvider(),
    );

    const fields: ParsedTemplatePlaceholder[] = [
      { raw: "{{string:data_nascita}}", name: "data_nascita", type: "string" },
    ];

    const report = await service.auditTemplate(
      "Data nascita: {{string:data_nascita}}",
      fields,
    );
    expect(report.failed).toBe(true);
    expect(report.warnings).toEqual([]);
  });

  it("AiTemplateAuditorService removes unsupported suggestedType", async () => {
    class UnsupportedSuggestionProvider extends MockAiProvider {
      override async analyzeTemplate(
        _input: AiTemplateAuditInput,
      ): Promise<AiTemplateAuditResult> {
        return {
          warnings: [
            {
              fieldName: "data_nascita",
              currentType: "string",
              suggestedType: "datetime",
              reason: "test",
              confidence: 0.9,
              severity: "warning",
            },
          ],
          model: "test",
          latencyMs: 1,
        };
      }
    }

    process.env.AI_PROVIDER = "mock";
    const service = new AiTemplateAuditorService(
      new UnsupportedSuggestionProvider(),
      new OllamaAiProvider(),
    );
    const fields: ParsedTemplatePlaceholder[] = [
      { raw: "{{string:data_nascita}}", name: "data_nascita", type: "string" },
    ];
    const report = await service.auditTemplate(
      "Data di nascita: {{string:data_nascita}}",
      fields,
    );

    expect(report.warnings).toEqual([]);
  });

  it("MockAiProvider keeps only real semantic mismatch for contract-like template", async () => {
    process.env.AI_PROVIDER = "mock";
    const service = new AiTemplateAuditorService(
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const fields: ParsedTemplatePlaceholder[] = [
      {
        raw: "{{string:numero_contratto}}",
        name: "numero_contratto",
        type: "string",
      },
      {
        raw: "{{string:ragione_sociale_cliente}}",
        name: "ragione_sociale_cliente",
        type: "string",
      },
      { raw: "{{string:data_stipula}}", name: "data_stipula", type: "string" },
      {
        raw: "{{currency:importo_totale}}",
        name: "importo_totale",
        type: "currency",
      },
      {
        raw: "{{string:referente_cliente}}",
        name: "referente_cliente",
        type: "string",
      },
    ];

    const markdown = [
      "**N. Contratto:** {{string:numero_contratto}}",
      "**Cliente:** {{string:ragione_sociale_cliente}}",
      "**Data stipula:** {{string:data_stipula}}",
      "**Importo totale:** {{currency:importo_totale}}",
      "**Referente:** {{string:referente_cliente}}",
    ].join("\n");

    const report = await service.auditTemplate(markdown, fields);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0]).toEqual(
      expect.objectContaining({
        fieldName: "data_stipula",
        currentType: "string",
        suggestedType: "date",
      }),
    );
  });

  it("flags boolean misuse for descriptive project manager authority fields", async () => {
    process.env.AI_PROVIDER = "mock";
    const service = new AiTemplateAuditorService(
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const fields: ParsedTemplatePlaceholder[] = [
      {
        raw: "{{boolean:autorita_project_manager}}",
        name: "autorita_project_manager",
        type: "boolean",
      },
    ];

    const report = await service.auditTemplate(
      "Autorita del PM: {{boolean:autorita_project_manager}}",
      fields,
    );

    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        fieldName: "autorita_project_manager",
        currentType: "boolean",
        suggestedType: "text",
      }),
    );
  });

  it("flags authority section modeled as contact placeholders", async () => {
    process.env.AI_PROVIDER = "mock";
    const service = new AiTemplateAuditorService(
      new MockAiProvider(),
      new OllamaAiProvider(),
    );
    const fields: ParsedTemplatePlaceholder[] = [
      {
        raw: "{{string:nome_authorita}}",
        name: "nome_authorita",
        type: "string",
      },
      {
        raw: "{{string:email_authorita}}",
        name: "email_authorita",
        type: "string",
      },
    ];
    const markdown = [
      "### Autorita del Project Manager",
      "{{string:nome_authorita}}",
      "{{string:email_authorita}}",
    ].join("\n");

    const report = await service.auditTemplate(markdown, fields);
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldName: "nome_authorita",
          suggestedType: "text",
        }),
        expect.objectContaining({
          fieldName: "email_authorita",
          suggestedType: "text",
        }),
      ]),
    );
  });
});
