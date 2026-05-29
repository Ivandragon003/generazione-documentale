export type TemplateAuditSeverity = "info" | "warning" | "error";

export interface TemplateValidationIssue {
  code:
    | "UNSUPPORTED_TYPE"
    | "UNCLOSED_PLACEHOLDER"
    | "MISSING_TYPE"
    | "INVALID_FORMAT"
    | "EXTRA_PARAMETERS"
    | "MALFORMED_PLACEHOLDER"
    | "UNBALANCED_PLACEHOLDER_BRACES"
    | "MISSING_PLACEHOLDER_TYPE"
    | "MISSING_FIELD_NAME"
    | "INVALID_PLACEHOLDER_TYPE"
    | "INVALID_EXTENDED_PLACEHOLDER"
    | "INVALID_LENGTH"
    | "INVALID_REQUIRED_FLAG"
    | "INVALID_LIST_DEFINITION"
    | "INVALID_TYPE"
    | "DUPLICATED_FIELD"
    | "REDUNDANT_FIELD_DECLARATION"
    | "DUPLICATED_SECTION"
    | "DUPLICATED_CONSECUTIVE_TITLE"
    | "TEXT_PLACEHOLDER_IN_TABLE"
    | "PLACEHOLDER_IN_TITLE"
    | "CONFLICTING_FIELD_TYPE"
    | "TABLE_ROW_SPLIT"
    | "MISSING_REQUIRED_SECTION"
    | "MISSING_REQUIRED_TABLE"
    | "MISSING_TABLE_COLUMNS"
    | "PROFILE_CONTAMINATION"
    | "NON_CANONICAL_PLACEHOLDER_FORM"
    | "OUTPUT_TRUNCATED";
  message: string;
  line: number;
  blocking: boolean;
  severity?: "error" | "warning";
  placeholder?: string;
  fieldName?: string;
  invalidType?: string;
  suggestion?: string;
  autoFixable?: boolean;
}

export interface AiSemanticWarning {
  fieldName: string;
  currentType: string;
  suggestedType: string | null;
  reason: string;
  confidence: number;
  severity: "info" | "warning";
}

export interface DeterministicValidationReport {
  errors: TemplateValidationIssue[];
  warnings: TemplateValidationIssue[];
  fields: Array<{ name: string; type: string; line: number }>;
  durationMs: number;
}

export interface AiAuditReport {
  warnings: AiSemanticWarning[];
  provider: string;
  model: string | null;
  latencyMs: number;
  failed?: boolean;
  error?: string;
}

export interface TemplateAuditReport {
  deterministic: DeterministicValidationReport;
  ai: AiAuditReport | null;
}

export interface TemplateAuditInput {
  content: string;
  runAi?: boolean;
  expectedDocumentType?:
    | "project_charter"
    | "capitolato"
    | "verbale"
    | "report"
    | "project_plan"
    | "scheda"
    | "checklist"
    | "requirements_document"
    | "policy"
    | "procedure"
    | "generic_template";
}
