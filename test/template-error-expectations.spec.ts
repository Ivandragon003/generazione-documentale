import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MockAiProvider } from "../src/service/ai/mock-ai.provider";
import { OllamaAiProvider } from "../src/service/ai/ollama-ai.provider";
import { AiTemplateAuditorService } from "../src/service/ai-template-auditor.service";
import { TemplateAuditService } from "../src/service/template-audit.service";
import { TemplatePlaceholderService } from "../src/service/template-placeholder.service";
import {
  compareExpectedVsDetected,
  extractStableErrorTypes,
  loadOfficialSupportedTypes,
  loadTemplateErrorExpectations,
  validateAfterRepair,
} from "./utils/template-error-expectations";

describe("Template error expectation map", () => {
  const fixturesDir = join(process.cwd(), "test", "fixtures", "templates");
  const expectations = loadTemplateErrorExpectations();
  const byFile = new Map(expectations.map((item) => [item.fileName, item]));
  const officialSupportedTypes = new Set(loadOfficialSupportedTypes());
  const auditService = new TemplateAuditService(
    new TemplatePlaceholderService(),
    new AiTemplateAuditorService(new MockAiProvider(), new OllamaAiProvider()),
  );

  function evaluateFixture(fileName: string) {
    const expected = byFile.get(fileName);
    if (!expected) {
      throw new Error(`Expectation missing for ${fileName}`);
    }
    const content = readFileSync(join(fixturesDir, fileName), "utf8");
    const report = auditService.validateDeterministic(content);
    const parsed = new TemplatePlaceholderService().parse(content);
    const detected = extractStableErrorTypes({
      errors: report.errors,
      warnings: report.warnings,
    });
    if (
      parsed.fields.some((field) => !officialSupportedTypes.has(field.type))
    ) {
      detected.push("INVALID_TYPE");
    }
    const dedupDetected = [...new Set(detected)];
    const compare = compareExpectedVsDetected(
      expected?.expectedSyntaxErrorTypes ?? [],
      dedupDetected,
    );
    const repair = validateAfterRepair(
      auditService,
      content,
      officialSupportedTypes,
    );
    return { expected, compare, repair, errors: report.errors };
  }

  it("fixture valida senza errori", () => {
    const result = evaluateFixture("08-ambiguous.md");
    expect(result.compare.match).toBe(true);
    expect(result.expected.expectedValid).toBe(true);
  });

  it("fixture con field_name accentato", () => {
    const result = evaluateFixture("12-complex-accent-length-list.md");
    expect(result.compare.match).toBe(true);
    expect(result.compare.unexpectedErrors).toEqual([]);
  });

  it("fixture con length non numerico", () => {
    const result = evaluateFixture("12-complex-accent-length-list.md");
    expect(result.expected.expectedSyntaxErrorTypes).toContain(
      "INVALID_LENGTH",
    );
    expect(result.compare.missingErrors).toEqual([]);
  });

  it("fixture con required non valido", () => {
    const result = evaluateFixture(
      "14-complex-invalid-required-list-values.md",
    );
    expect(result.expected.expectedSyntaxErrorTypes).toContain(
      "INVALID_REQUIRED",
    );
    expect(result.compare.match).toBe(true);
  });

  it("fixture con lista malformata", () => {
    const result = evaluateFixture(
      "14-complex-invalid-required-list-values.md",
    );
    expect(result.expected.expectedSyntaxErrorTypes).toContain(
      "INVALID_LIST_SYNTAX",
    );
    expect(result.compare.match).toBe(true);
  });

  it("fixture con placeholder non bilanciato", () => {
    const result = evaluateFixture("15-complex-unbalanced-mixed.md");
    expect(result.expected.expectedSyntaxErrorTypes).toContain(
      "UNBALANCED_PLACEHOLDER",
    );
    expect(result.compare.match).toBe(true);
  });

  it("fixture con più errori contemporanei", () => {
    const result = evaluateFixture("12-complex-accent-length-list.md");
    expect(result.expected.expectedSyntaxErrorTypes.length).toBeGreaterThan(1);
    expect(result.compare.match).toBe(true);
  });

  it("fixture riparabile", () => {
    const result = evaluateFixture("16-repairable-accent-length.md");
    expect(result.expected.expectedRepairable).toBe(true);
    expect(result.repair.repairApplied).toBe(true);
    expect(result.repair.validableAfterRepair).toBe(
      result.expected.expectedSavableAfterRepair,
    );
  });

  it("fixture non riparabile in sicurezza", () => {
    const result = evaluateFixture(
      "14-complex-invalid-required-list-values.md",
    );
    expect(result.expected.expectedRepairable).toBe(false);
    expect(result.repair.validableAfterRepair).toBe(false);
  });
});
