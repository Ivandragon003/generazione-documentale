import { readFileSync } from "node:fs";
import { join } from "node:path";

const rootDir = process.cwd();
const readSource = (relativePath: string): string =>
  readFileSync(join(rootDir, relativePath), "utf8");

describe("Template draft safe correction UI flow", () => {
  it("uses backend repair endpoint and revalidates errors from backend", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("repairTemplateDraft({");
    expect(workspace).toContain("setDraftResult(repaired)");
    expect(workspace).toContain("content: sourceMarkdown");
    expect(workspace).toContain(
      "await validateEditorContent(repairedMarkdown)",
    );
  });

  it("binds Apply safe corrections button to dedicated backend correction handler", () => {
    const panel = readSource(
      "frontend/src/modules/templates/components/TemplateDraftGeneratorPanel.tsx",
    );
    expect(panel).toContain("onApplySafeCorrectionToDraft");
    expect(panel).toContain("Correzioni suggerite:");
    expect(panel).toContain("Correzioni applicate:");
    expect(panel).toContain("Errori rimanenti:");
  });

  it("validates immediately after Load in editor without manual typing", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("const validateEditorContent = useCallback");
    expect(workspace).toContain("await validateEditorContent(nextContent)");
  });

  it("does not clear editor when repaired markdown is empty", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("hasValidRepairedMarkdown");
    expect(workspace).toContain(
      'notifyError("Nessuna correzione sicura applicata")',
    );
    expect(workspace).not.toContain("setMarkdown(previousEditorMarkdown)");
  });

  it("keeps current editor content unchanged on backend error", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain(
      'notifyError(friendlyErrorMessage(error, "Safe correction failed."))',
    );
    expect(workspace).not.toContain("setMarkdown(previousEditorMarkdown)");
  });

  it("logs debug lengths and repair status during safe correction", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("const applySafeCorrectionToContent");
    expect(workspace).toContain("sourceMarkdown");
    expect(workspace).toContain("repairAppliedCount");
    expect(workspace).toContain("handleApplySafeCorrectionToDraft");
  });

  it("applies correction only after a valid non-empty repaired markdown", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("if (!hasValidRepairedMarkdown) {");
    expect(workspace).toContain("if (repairAppliedCount === 0) {");
    expect(workspace).toContain("if (repairedMarkdown === sourceMarkdown) {");
    expect(workspace).toContain("setMarkdown(repairedMarkdown)");
    expect(workspace).toContain(
      "await validateEditorContent(repairedMarkdown)",
    );
  });

  it("keeps repair diagnostics synchronized after a successful correction", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain(
      "setAiWarnings(repaired.semanticAudit?.warnings ?? [])",
    );
    expect(workspace).toContain("setAiMeta(repaired.ai ?? null)");
    expect(workspace).toContain("setDraftResult(repaired)");
  });

  it("does not use repair endpoint during live validation", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    const validationStart = workspace.indexOf(
      "const validateEditorContent = useCallback",
    );
    const validationEnd = workspace.indexOf("const handleRunAiReview");
    const validationBlock = workspace.slice(validationStart, validationEnd);
    expect(validationBlock).toContain("validateTemplateMarkdown(content)");
    expect(validationBlock).not.toContain("repairTemplateDraft");
    expect(validationBlock).not.toContain("setMarkdown(");
  });

  it("reuses centralized validation during typing and template load", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("void validateEditorContent(markdown)");
    expect(workspace).toContain(
      "await validateEditorContent(fullTemplate.content)",
    );
  });

  it("deduplicates backend validation for unchanged editor markdown", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("lastValidationRef");
    expect(workspace).toContain("inFlightValidationRef");
    expect(workspace).toContain(
      "if (inFlight && inFlight.content === content) {",
    );
    expect(workspace).toContain(
      "Always recompute diagnostics from scratch for each validation run.",
    );
  });

  it("maps backend deterministic errors with real line/column metadata", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("validation.deterministic?.errors");
    expect(workspace).toContain("findIssueColumn(");
    expect(workspace).toContain("mapDeterministicIssue(");
  });

  it("uses configurable debounce values for live validation and template search", () => {
    const workspace = readSource(
      "frontend/src/modules/templates/TemplatesWorkspace.tsx",
    );
    expect(workspace).toContain("VITE_EDITOR_VALIDATE_DEBOUNCE_MS");
    expect(workspace).toContain("VITE_TEMPLATE_SEARCH_DEBOUNCE_MS");
    expect(workspace).toContain("searchDebounceMs");
    expect(workspace).toContain("liveValidationDebounceMs");
  });
});
