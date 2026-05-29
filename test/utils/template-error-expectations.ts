import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { TemplateValidationIssue } from "../../src/common/types/template-audit.type";
import type { TemplateAuditService } from "../../src/service/template-audit.service";
import { TemplatePlaceholderService } from "../../src/service/template-placeholder.service";

export type StableTemplateErrorCode =
  | "INVALID_FIELD_NAME"
  | "INVALID_LENGTH"
  | "INVALID_REQUIRED"
  | "INVALID_LIST_SYNTAX"
  | "UNBALANCED_PLACEHOLDER"
  | "DUPLICATED_FIELD"
  | "TECHNICAL_PLACEHOLDER_FORBIDDEN"
  | "TYPE_CONFLICT"
  | "MISSING_REQUIRED_SECTION"
  | "INVALID_PLACEHOLDER_TYPE"
  | "INVALID_TYPE"
  | "MISSING_PLACEHOLDER_TYPE";

export interface TemplateErrorExpectation {
  fileName: string;
  description: string;
  expectedValid: boolean;
  expectedSyntaxErrorTypes: StableTemplateErrorCode[];
  expectedRepairable: boolean;
  expectedRepairActions: string[];
  expectedSavableAfterRepair: boolean;
  notes: string;
}

export function loadTemplateErrorExpectations(): TemplateErrorExpectation[] {
  const path = join(
    process.cwd(),
    "test",
    "fixtures",
    "template-error-expectations.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as TemplateErrorExpectation[];
}

export function loadOfficialSupportedTypes(): string[] {
  const path = join(
    process.cwd(),
    "test",
    "fixtures",
    "templates",
    "placeholder-validation-policy.json",
  );
  const parsed = JSON.parse(readFileSync(path, "utf8")) as {
    officialSupportedTypes?: string[];
  };
  return (parsed.officialSupportedTypes ?? []).map((item) =>
    item.trim().toLowerCase(),
  );
}

function issueToStableCode(
  issue: TemplateValidationIssue,
): StableTemplateErrorCode | null {
  if (issue.code === "UNCLOSED_PLACEHOLDER") return "UNBALANCED_PLACEHOLDER";
  if (issue.code === "DUPLICATED_FIELD") return "DUPLICATED_FIELD";
  if (issue.code === "CONFLICTING_FIELD_TYPE") return "TYPE_CONFLICT";
  if (issue.code === "INVALID_TYPE") return "INVALID_TYPE";
  if (issue.code === "MISSING_TYPE") return "MISSING_PLACEHOLDER_TYPE";
  if (issue.code === "UNSUPPORTED_TYPE") return "INVALID_PLACEHOLDER_TYPE";
  if (issue.code === "INVALID_FORMAT") {
    if (issue.message.includes("field_name")) return "INVALID_FIELD_NAME";
    if (
      issue.placeholder?.startsWith("{{list:") ||
      issue.message.includes("list_name") ||
      issue.message.includes("list values") ||
      issue.message.includes("list label") ||
      issue.message.includes("list options")
    ) {
      return "INVALID_LIST_SYNTAX";
    }
    return null;
  }
  if (issue.code === "EXTRA_PARAMETERS") {
    if (issue.message.includes("Invalid length")) return "INVALID_LENGTH";
    if (issue.message.includes("required value")) return "INVALID_REQUIRED";
    if (
      issue.message.includes("list_name") ||
      issue.message.includes("list values") ||
      issue.message.includes("list label") ||
      issue.message.includes("list options")
    ) {
      return "INVALID_LIST_SYNTAX";
    }
  }
  return null;
}

export function extractStableErrorTypes(input: {
  errors: TemplateValidationIssue[];
  warnings: TemplateValidationIssue[];
}): StableTemplateErrorCode[] {
  const collected = [...input.errors, ...input.warnings]
    .map(issueToStableCode)
    .filter((item): item is StableTemplateErrorCode => item !== null);
  return [...new Set(collected)];
}

export function compareExpectedVsDetected(
  expected: StableTemplateErrorCode[],
  detected: StableTemplateErrorCode[],
): {
  match: boolean;
  missingErrors: StableTemplateErrorCode[];
  unexpectedErrors: StableTemplateErrorCode[];
} {
  const expectedSet = new Set(expected);
  const detectedSet = new Set(detected);
  const missingErrors = expected.filter((error) => !detectedSet.has(error));
  const unexpectedErrors = detected.filter((error) => !expectedSet.has(error));
  return {
    match: missingErrors.length === 0 && unexpectedErrors.length === 0,
    missingErrors,
    unexpectedErrors,
  };
}

function normalizeFieldName(fieldName: string): string {
  return fieldName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/^(\d)/, "_$1")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function simulateSafeAutoRepair(
  markdown: string,
  defaultLength = 120,
): { repairedContent: string; applied: boolean; actions: string[] } {
  const actions: string[] = [];
  const repaired = markdown.replace(/\{\{([^{}\n]+)\}\}/g, (token, inner) => {
    const parts = String(inner)
      .split(":")
      .map((part) => part.trim());
    if (parts.length < 2) return token;
    const type = parts[0] ?? "";
    let fieldName = parts[1] ?? "";
    const normalizedFieldName = normalizeFieldName(fieldName);
    if (!normalizedFieldName) return token;
    if (normalizedFieldName !== fieldName) {
      actions.push("normalize_field_name");
      fieldName = normalizedFieldName;
    }
    if (parts.length >= 3 && !/^\d+$/.test(parts[2] ?? "")) {
      parts[2] = String(defaultLength);
      actions.push("set_default_length");
    }
    return `{{${[type, fieldName, ...parts.slice(2)].join(":")}}}`;
  });
  return {
    repairedContent: repaired,
    applied: actions.length > 0,
    actions: [...new Set(actions)],
  };
}

export function validateAfterRepair(
  auditService: TemplateAuditService,
  markdown: string,
  officialSupportedTypes: Set<string>,
  defaultLength = 120,
): {
  repairApplied: boolean;
  repairActions: string[];
  validableAfterRepair: boolean;
} {
  const repair = simulateSafeAutoRepair(markdown, defaultLength);
  const report = auditService.validateDeterministic(repair.repairedContent);
  const placeholderService = new TemplatePlaceholderService();
  const parsed = placeholderService.parse(repair.repairedContent);
  const hasUnsupportedType = parsed.fields.some(
    (field: { type: string }) => !officialSupportedTypes.has(field.type),
  );
  return {
    repairApplied: repair.applied,
    repairActions: repair.actions,
    validableAfterRepair: report.errors.length === 0 && !hasUnsupportedType,
  };
}
