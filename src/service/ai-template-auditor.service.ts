import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiAuditReport } from "../common/types/template-audit.type";
import type {
  AiProvider,
  AiTemplateFieldContext,
} from "./ai/ai-provider.interface";
import { MockAiProvider } from "./ai/mock-ai.provider";
import { OllamaAiProvider } from "./ai/ollama-ai.provider";
import {
  allowedTemplateFieldTypes,
  type ParsedTemplatePlaceholder,
} from "./template-placeholder.service";

@Injectable()
export class AiTemplateAuditorService {
  private readonly logger = new Logger(AiTemplateAuditorService.name);
  private readonly cache = new Map<
    string,
    { expiresAt: number; report: AiAuditReport }
  >();

  constructor(
    @Inject(MockAiProvider)
    private readonly mockAiProvider: MockAiProvider,
    @Inject(OllamaAiProvider)
    private readonly ollamaAiProvider: OllamaAiProvider,
  ) {}

  private resolveProvider(): AiProvider {
    const requested = (process.env.AI_PROVIDER?.trim().toLowerCase() ||
      "mock") as "mock" | "ollama";
    if (requested === "ollama") return this.ollamaAiProvider;
    return this.mockAiProvider;
  }

  private extractFieldContexts(
    markdown: string,
    fields: ParsedTemplatePlaceholder[],
  ): AiTemplateFieldContext[] {
    const lines = markdown.split(/\r?\n/);
    const allowedTypes = [...allowedTemplateFieldTypes];

    const normalizeWhitespace = (value: string): string =>
      value.replace(/\s+/g, " ").trim();

    const extractTableNeighborText = (
      lineWithField: string,
      marker: string,
    ): string | null => {
      const trimmed = lineWithField.trim();
      if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((cell) => normalizeWhitespace(cell));
      const cellIndex = cells.findIndex((cell) => cell.includes(marker));
      if (cellIndex <= 0) return null;
      return cells[cellIndex - 1] || null;
    };

    return fields.map((field) => {
      const marker = field.raw;
      const lineWithField =
        lines.find((line) => line.includes(marker)) ??
        lines.find((line) =>
          line.toLowerCase().includes(field.name.toLowerCase()),
        ) ??
        "";
      const neighborText = extractTableNeighborText(lineWithField, marker);
      const inlineContext = lineWithField
        .replace(field.raw, "")
        .replace(/\|/g, " ")
        .trim();
      const surroundingText = normalizeWhitespace(
        neighborText || inlineContext || field.name,
      );
      return {
        fieldName: field.name,
        currentType: field.type,
        surroundingText,
        fullLine: normalizeWhitespace(lineWithField),
        allowedTypes,
      };
    });
  }

  private detectDescriptiveBooleanMisuse(
    fields: ParsedTemplatePlaceholder[],
  ): Array<{
    fieldName: string;
    currentType: string;
    suggestedType: string;
    reason: string;
    confidence: number;
    severity: "warning";
  }> {
    const descriptiveHints =
      /(autorita|authority|criteri|successo|ambito|scope|rischi|risk|business_case|businesscase|project_manager)/i;
    return fields
      .filter(
        (field) =>
          field.type === "boolean" && descriptiveHints.test(field.name),
      )
      .map((field) => ({
        fieldName: field.name,
        currentType: "boolean",
        suggestedType: "text",
        reason:
          "Descriptive section detected: boolean is too restrictive, use text or a markdown table with valid placeholders.",
        confidence: 0.95,
        severity: "warning" as const,
      }));
  }

  private detectAuthorityContactModelingMisuse(
    markdown: string,
    fields: ParsedTemplatePlaceholder[],
  ): Array<{
    fieldName: string;
    currentType: string;
    suggestedType: string;
    reason: string;
    confidence: number;
    severity: "warning";
  }> {
    const hasAuthoritySection =
      /autorita\s+del\s+project\s+manager|authority\s+of\s+the\s+project\s+manager/i.test(
        markdown,
      );
    if (!hasAuthoritySection) return [];
    const contactPattern =
      /(nome_authorita|email_authorita|telefono_authorita)/i;
    return fields
      .filter((field) => contactPattern.test(field.name))
      .map((field) => ({
        fieldName: field.name,
        currentType: field.type,
        suggestedType: "text",
        reason:
          "Authority section modeled as contacts: describe decision scope, granted authority and limits instead of contact details.",
        confidence: 0.95,
        severity: "warning" as const,
      }));
  }

  async auditTemplate(
    markdown: string,
    fields: ParsedTemplatePlaceholder[],
  ): Promise<AiAuditReport> {
    const debugEnabled = process.env.AI_AUDIT_DEBUG === "true";
    const minConfidenceRaw = Number(
      process.env.AI_AUDIT_MIN_CONFIDENCE ?? "0.6",
    );
    const minConfidence =
      Number.isFinite(minConfidenceRaw) &&
      minConfidenceRaw >= 0 &&
      minConfidenceRaw <= 1
        ? minConfidenceRaw
        : 0.6;
    const cacheTtlMsRaw = Number(process.env.AI_AUDIT_CACHE_TTL_MS ?? "300000");
    const cacheTtlMs =
      Number.isFinite(cacheTtlMsRaw) && cacheTtlMsRaw >= 0
        ? cacheTtlMsRaw
        : 300000;
    const provider = this.resolveProvider();
    const supportedTypes = [...allowedTemplateFieldTypes];
    const supportedTypeSet = new Set<string>(supportedTypes);
    const knownFields = new Set<string>(fields.map((field) => field.name));
    const cacheKey =
      provider.name === "ollama" && cacheTtlMs > 0
        ? createHash("sha256")
            .update(markdown)
            .update("\n")
            .update(supportedTypes.join(","))
            .digest("hex")
        : null;
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (debugEnabled) {
          this.logger.log(`AI audit cache hit provider=${provider.name}`);
        }
        return cached.report;
      }
    }
    try {
      const result = await provider.analyzeTemplate({
        markdown,
        fields: this.extractFieldContexts(markdown, fields),
        allowedTypes: supportedTypes,
      });
      const warnings = result.warnings
        .filter(
          (warning) =>
            knownFields.has(warning.fieldName) &&
            supportedTypeSet.has(warning.currentType),
        )
        .map((warning) => ({
          ...warning,
          reason: warning.reason.trim(),
        }))
        .filter(
          (warning) =>
            warning.reason.length > 8 &&
            !/\b(currentType\s+is\s+correct|tipo\s+corrente\s+corretto|tipo\s+coerente|already\s+correct|already\s+coherent)\b/i.test(
              warning.reason,
            ),
        )
        .map((warning) => ({
          ...warning,
          suggestedType:
            warning.suggestedType && supportedTypeSet.has(warning.suggestedType)
              ? warning.suggestedType
              : null,
        }))
        .filter((warning) => warning.suggestedType !== null)
        .filter((warning) => warning.suggestedType !== warning.currentType)
        .filter((warning) => warning.confidence >= minConfidence);
      const booleanMisuseWarnings = this.detectDescriptiveBooleanMisuse(fields);
      const authorityContactWarnings =
        this.detectAuthorityContactModelingMisuse(markdown, fields);
      const mergedWarnings = [
        ...warnings,
        ...booleanMisuseWarnings,
        ...authorityContactWarnings,
      ].filter(
        (warning, index, items) =>
          items.findIndex(
            (candidate) =>
              candidate.fieldName === warning.fieldName &&
              candidate.suggestedType === warning.suggestedType,
          ) === index,
      );
      if (debugEnabled) {
        this.logger.log(
          `AI audit provider=${provider.name} model=${result.model ?? "n/a"} latencyMs=${result.latencyMs} warnings=${warnings.length}`,
        );
      }
      const report = {
        warnings: mergedWarnings,
        provider: provider.name,
        model: result.model,
        latencyMs: result.latencyMs,
      };
      if (cacheKey) {
        this.cache.set(cacheKey, {
          expiresAt: Date.now() + cacheTtlMs,
          report,
        });
      }
      return report;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (debugEnabled) {
        this.logger.warn(
          `AI audit failed provider=${provider.name} error=${message}`,
        );
      }
      return {
        warnings: [],
        provider: provider.name,
        model: null,
        latencyMs: 0,
        failed: true,
        error: message,
      };
    }
  }
}
