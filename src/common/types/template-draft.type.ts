import type {
  AiSemanticWarning,
  DeterministicValidationReport,
} from "./template-audit.type";

export interface TemplateDraftGenerationAiMeta {
  provider: string;
  model: string | null;
  latencyMs: number;
  failed: boolean;
  error: string | null;
}

export interface TemplateDraftBenchmark {
  model: string | null;
  numPredict: number | null;
  temperature: number | null;
  auditEnabled: boolean;
  generationDurationMs: number;
  outputLength: number;
  syntaxErrorCount: number;
  syntaxErrorTypes: string[];
  outputComplete: boolean;
  validationPassed: boolean;
  repairApplied: boolean;
  syntaxSpecIncluded: boolean;
  syntaxSpecVersion: string | null;
  parserVersion: string | null;
  generationMode: "free" | "guided";
}

export interface TemplateDraftEvaluationBucket {
  valid: boolean;
  issues: string[];
}

export interface TemplateDraftGenerationResult {
  content: string;
  fields: DeterministicValidationReport["fields"];
  placeholderAnalysis: {
    extractedFields: Array<{ raw: string; type: string; name: string }>;
    validFields: Array<{ raw: string; type: string; name: string }>;
    invalidPlaceholders: string[];
    syntaxErrors: string[];
    unsupportedTypes: string[];
    duplicatedPlaceholders: string[];
    placeholdersInTitles: string[];
    truncatedOutputErrors: string[];
    nonExtractedInvalidPlaceholders: string[];
    repairableErrors: string[];
    nonRepairableErrors: string[];
    repairableErrorsAvailable: boolean;
    repairApplied: boolean;
    blockingErrorsAfterRepair: number;
    sectionsWithDescription: number;
    sectionsMissingDescription: number;
    genericDescriptionsCount: number;
    didacticQualityScore: number;
  };
  deterministic: Pick<
    DeterministicValidationReport,
    "errors" | "warnings" | "durationMs"
  >;
  semanticAudit: {
    warnings: AiSemanticWarning[];
  };
  ai: TemplateDraftGenerationAiMeta;
  benchmark: TemplateDraftBenchmark;
  evaluation: {
    syntaxValidity: TemplateDraftEvaluationBucket;
    structuralCompleteness: TemplateDraftEvaluationBucket;
    semanticQuality: TemplateDraftEvaluationBucket;
    promptConformity: TemplateDraftEvaluationBucket;
    didacticQuality: TemplateDraftEvaluationBucket & {
      score: number;
      sectionsWithDescription: number;
      sectionsMissingDescription: number;
      genericDescriptionsCount: number;
    };
  };
  repair: {
    applied: boolean;
    changes: string[];
    errorsBeforeRepair: number;
    repairableErrorsAvailable: boolean;
    repairAppliedCount: number;
    repairedPlaceholders: string[];
    errorsAfterRepair: number;
    blockingErrorsAfterRepair: number;
    finalValidationPassed: boolean;
  };
  savable: boolean;
}
