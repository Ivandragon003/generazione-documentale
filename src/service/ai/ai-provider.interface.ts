import type { AiSemanticWarning } from "../../common/types/template-audit.type";

export interface AiTemplateFieldContext {
  fieldName: string;
  currentType: string;
  surroundingText: string;
  fullLine: string;
  allowedTypes: string[];
}

export interface AiTemplateAuditInput {
  markdown: string;
  fields: AiTemplateFieldContext[];
  allowedTypes: string[];
}

export interface AiTemplateAuditResult {
  warnings: AiSemanticWarning[];
  model: string | null;
  latencyMs: number;
}

export interface TemplateSyntaxVariant {
  id: "legacy" | "strict" | "lengthOnly" | "extended" | "extendedList";
  format: string;
  example: string;
}

export interface TemplateSyntaxProfile {
  fieldNamePattern: string;
  supportedTypes: string[];
  variants: TemplateSyntaxVariant[];
}

export interface TemplateSyntaxSpec {
  version: string;
  parserVersion: string | null;
  supportedTypes: string[];
  compactGrammar: string;
  canonicalExamples?: string[];
}

export interface AiTemplateDraftInput {
  description: string;
  language?: string;
  syntaxProfile: TemplateSyntaxProfile;
  generationMode?: "free" | "guided";
  syntaxSpec?: TemplateSyntaxSpec | null;
  outputConstraints?: {
    allowTechnicalPlaceholders: boolean;
    requireTechnicalPlaceholders: boolean;
  };
}

export interface AiTemplateDraftResult {
  markdown: string;
  model: string | null;
  latencyMs: number;
  options?: {
    numPredict?: number | null;
    temperature?: number | null;
  };
}

export interface AiProvider {
  readonly name: string;
  analyzeTemplate(input: AiTemplateAuditInput): Promise<AiTemplateAuditResult>;
  generateTemplateDraft(
    input: AiTemplateDraftInput,
  ): Promise<AiTemplateDraftResult>;
}
