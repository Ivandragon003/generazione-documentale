import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface DatasetCase {
  id: string;
  dir: string;
  template: string;
  inputValid: Record<string, unknown>;
  inputInvalid: Record<string, unknown>;
  expectedSchema: Record<string, unknown>;
  expectedErrors: Record<string, unknown>;
  expectedRender: string;
}

const DEFAULT_DATASET_ROOT = join(process.cwd(), "test", "fixtures", "dataset");

export interface DatasetLoadIssue {
  caseId: string;
  file?: string;
  code: "MISSING_FILE" | "INVALID_JSON" | "INVALID_CASE_DIR";
  message: string;
}

interface LoaderOptions {
  requireConfigured?: boolean;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

export function resolveDatasetRoot(options: LoaderOptions = {}): string {
  const configured = process.env.DATASET_PATH?.trim();
  if (!configured && options.requireConfigured) {
    throw new Error(
      "DATASET_PATH non configurato. Imposta DATASET_PATH per eseguire i test sul dataset tesi.",
    );
  }
  if (!configured) {
    return DEFAULT_DATASET_ROOT;
  }
  return join(process.cwd(), configured);
}

export function loadDatasetCases(options: LoaderOptions = {}): DatasetCase[] {
  const root = resolveDatasetRoot(options);
  if (!existsSync(root)) {
    throw new Error(
      "DATASET_PATH non configurato. Imposta DATASET_PATH per eseguire i test sul dataset tesi.",
    );
  }
  const entries = readdirSync(root)
    .map((name) => ({
      name,
      fullPath: join(root, name),
    }))
    .filter((entry) => statSync(entry.fullPath).isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const issues: DatasetLoadIssue[] = [];
  const cases: DatasetCase[] = [];

  for (const entry of entries) {
    const templatePath = join(entry.fullPath, "template.md");
    const validPath = join(entry.fullPath, "input-valid.json");
    const invalidPath = join(entry.fullPath, "input-invalid.json");
    const schemaPath = join(entry.fullPath, "expected-schema.json");
    const errorsPath = join(entry.fullPath, "expected-errors.json");
    const renderPath = join(entry.fullPath, "expected-render.md");

    if (!existsSync(templatePath)) {
      issues.push({
        caseId: entry.name,
        file: "template.md",
        code: "MISSING_FILE",
        message: "Missing required file template.md",
      });
      continue;
    }
    if (!existsSync(validPath)) {
      issues.push({
        caseId: entry.name,
        file: "input-valid.json",
        code: "MISSING_FILE",
        message: "Missing required file input-valid.json",
      });
      continue;
    }

    try {
      cases.push({
        id: entry.name,
        dir: entry.fullPath,
        template: readFileSync(templatePath, "utf8"),
        inputValid: readJson(validPath),
        inputInvalid: existsSync(invalidPath) ? readJson(invalidPath) : {},
        expectedSchema: existsSync(schemaPath) ? readJson(schemaPath) : {},
        expectedErrors: existsSync(errorsPath) ? readJson(errorsPath) : {},
        expectedRender: existsSync(renderPath)
          ? readFileSync(renderPath, "utf8")
          : "",
      });
    } catch (error) {
      issues.push({
        caseId: entry.name,
        code: "INVALID_JSON",
        message:
          error instanceof Error
            ? error.message
            : "Invalid JSON in dataset case files",
      });
    }
  }

  if (issues.length > 0) {
    const details = issues
      .map(
        (issue) =>
          `- [${issue.caseId}] ${issue.code}${issue.file ? ` (${issue.file})` : ""}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Dataset loading errors:\n${details}`);
  }

  return cases;
}
