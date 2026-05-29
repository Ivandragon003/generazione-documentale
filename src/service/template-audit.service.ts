import { Inject, Injectable } from "@nestjs/common";
import type {
  DeterministicValidationReport,
  TemplateAuditInput,
  TemplateAuditReport,
  TemplateValidationIssue,
} from "../common/types/template-audit.type";
import {
  normalizeFieldName,
  titleFromFieldName,
} from "../common/utils/field-name.utils";
import { AiTemplateAuditorService } from "./ai-template-auditor.service";
import { TemplateIntentClassifier } from "./template-intent.classifier";
import {
  type ParsedTemplatePlaceholder,
  TemplatePlaceholderService,
} from "./template-placeholder.service";
import {
  AUDIT_DOCUMENT_REQUIRED_PROFILES,
  type AuditSectionRule,
  DOCUMENT_BLUEPRINTS,
} from "./template-profiles/document-type.profiles";

interface TokenLineRef {
  token: string;
  line: number;
}
type AuditDocumentType = NonNullable<
  TemplateAuditInput["expectedDocumentType"]
>;

const TOKEN_REGEX = /\{\{[^{}\n]*\}\}/g;
const DOCUMENT_REQUIRED_PROFILES = AUDIT_DOCUMENT_REQUIRED_PROFILES as Partial<
  Record<
    AuditDocumentType,
    {
      sections: AuditSectionRule[];
    }
  >
>;

@Injectable()
export class TemplateAuditService {
  private readonly intentClassifier = new TemplateIntentClassifier();

  constructor(
    @Inject(TemplatePlaceholderService)
    private readonly placeholderService: TemplatePlaceholderService,
    @Inject(AiTemplateAuditorService)
    private readonly aiTemplateAuditorService: AiTemplateAuditorService,
  ) {}

  private collectTokensWithLine(content: string): TokenLineRef[] {
    const refs: TokenLineRef[] = [];
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const match of line.matchAll(TOKEN_REGEX)) {
        refs.push({ token: match[0], line: index + 1 });
      }
    });
    return refs;
  }

  private parseErrorToIssue(
    message: string,
    line: number,
    placeholderCandidate?: string,
  ): TemplateValidationIssue {
    const placeholder =
      this.extractTokenFromMessage(message) ??
      placeholderCandidate ??
      undefined;
    if (
      message.includes("unsupported type") ||
      message.includes("Invalid placeholder type")
    ) {
      const invalidTypeMatch =
        message.match(/unsupported type "([^"]+)"/i) ??
        message.match(/type: "([^"]+)"/i);
      const suggestionMatch = message.match(/Did you mean "([^"]+)"/i);
      const invalidType = invalidTypeMatch?.[1];
      const suggestedType = suggestionMatch?.[1];
      let suggestion: string | undefined;
      if (placeholder && invalidType && suggestedType) {
        suggestion = placeholder.replace(
          `{{${invalidType}:`,
          `{{${suggestedType}:`,
        );
      }
      return {
        code: "UNSUPPORTED_TYPE",
        message,
        line,
        blocking: true,
        severity: "error",
        placeholder,
        invalidType,
        suggestion: suggestion ?? suggestedType,
        autoFixable: Boolean(placeholder && invalidType && suggestedType),
      };
    }
    if (message.includes("field_name")) {
      const normalizedSuggestion =
        this.buildNormalizedFieldNameSuggestion(placeholder);
      return {
        code: "INVALID_FORMAT",
        message,
        line,
        blocking: true,
        severity: "error",
        placeholder,
        suggestion: normalizedSuggestion ?? undefined,
        autoFixable: Boolean(normalizedSuggestion),
      };
    }
    if (message.includes("expected format")) {
      return {
        code: "INVALID_FORMAT",
        message,
        line,
        blocking: true,
        severity: "error",
        placeholder,
        autoFixable: false,
      };
    }
    if (
      message.includes("length") ||
      message.includes("required value") ||
      message.includes("list values") ||
      message.includes("list options") ||
      message.includes("list label") ||
      message.includes("list_name")
    ) {
      const parsedPlaceholder = placeholderCandidate
        ? this.placeholderService.parseTypedPlaceholder(placeholderCandidate)
        : null;
      const isListToken = Boolean(
        placeholderCandidate?.trim().toLowerCase().startsWith("{{list:"),
      );
      const isInvalidLength =
        message.startsWith("Invalid length:") ||
        message.includes("length must be a positive integer");
      // Safe only when we can deterministically patch without semantic ambiguity.
      // list placeholders are excluded from safe-fix classification here.
      const autoFixable =
        isInvalidLength &&
        Boolean(
          placeholderCandidate &&
            !isListToken &&
            (!parsedPlaceholder?.valid || parsedPlaceholder.type !== "list"),
        );
      return {
        code: "EXTRA_PARAMETERS",
        message,
        line,
        blocking: true,
        severity: "error",
        placeholder,
        autoFixable,
      };
    }
    if (message.includes("Conflicting placeholder types")) {
      const fieldMatch = message.match(/field "([^"]+)"/i);
      return {
        code: "CONFLICTING_FIELD_TYPE",
        message,
        line,
        blocking: true,
        severity: "error",
        placeholder,
        autoFixable: false,
        fieldName: fieldMatch?.[1],
      };
    }
    return {
      code: "INVALID_FORMAT",
      message,
      line,
      blocking: true,
      severity: "error",
      placeholder,
      autoFixable: false,
    };
  }

  private buildNormalizedFieldNameSuggestion(
    placeholder?: string,
  ): string | null {
    if (!placeholder) return null;
    const parsed = this.placeholderService.parseTypedPlaceholder(placeholder);
    const nameFromParser = parsed.valid ? parsed.name : null;
    const fallbackNameMatch = placeholder.match(/^\{\{[a-z]+:([^:}]+)/i);
    const fieldName = nameFromParser ?? fallbackNameMatch?.[1] ?? null;
    if (!fieldName) return null;
    const normalized = normalizeFieldName(fieldName);
    if (!normalized || normalized === fieldName) return null;
    return placeholder.replace(`:${fieldName}`, `:${normalized}`);
  }

  private findLineByToken(tokenRefs: TokenLineRef[], token: string): number {
    return tokenRefs.find((ref) => ref.token === token)?.line ?? 1;
  }

  private detectUnbalancedBraces(content: string): TemplateValidationIssue[] {
    const issues: TemplateValidationIssue[] = [];
    const openCount = (content.match(/\{\{/g) ?? []).length;
    const closeCount = (content.match(/\}\}/g) ?? []).length;
    if (openCount === closeCount) return issues;
    issues.push({
      code: "UNCLOSED_PLACEHOLDER",
      message: "Unbalanced placeholder braces detected: check {{ and }}",
      line: 1,
      blocking: true,
      severity: "error",
      autoFixable: false,
    });
    return issues;
  }

  private detectMissingTypeWarnings(
    parseResult: ReturnType<TemplatePlaceholderService["parse"]>,
    tokenRefs: TokenLineRef[],
  ): TemplateValidationIssue[] {
    const warnings: TemplateValidationIssue[] = [];
    const uniqueNames = [...new Set(parseResult.legacyUntypedNames)];
    for (const name of uniqueNames) {
      const placeholder = `{{${name}}}`;
      warnings.push({
        code: "MISSING_TYPE",
        message: `Legacy placeholder without explicit type: ${placeholder}`,
        line: this.findLineByToken(tokenRefs, placeholder),
        blocking: false,
        severity: "warning",
        placeholder,
        suggestion: `{{string:${name}}}`,
        autoFixable: false,
        fieldName: name,
      });
    }
    return warnings;
  }

  private detectDuplicateWarnings(
    content: string,
    tokenRefs: TokenLineRef[],
  ): TemplateValidationIssue[] {
    const warnings: TemplateValidationIssue[] = [];
    const headingLines = new Set(
      content
        .split(/\r?\n/)
        .map((line, index) => ({ line, idx: index + 1 }))
        .filter((item) => /^\s{0,3}#{1,6}\s+/.test(item.line))
        .map((item) => item.idx),
    );
    const occurrences = new Map<string, number[]>();
    for (const tokenRef of tokenRefs) {
      const parsed = this.placeholderService.parseTypedPlaceholder(
        tokenRef.token,
      );
      if (!parsed.valid || !parsed.name || !parsed.type) continue;
      const key = `${parsed.name}:${parsed.type}`;
      const lines = occurrences.get(key) ?? [];
      lines.push(tokenRef.line);
      occurrences.set(key, lines);
    }
    for (const [fieldAndType, lines] of occurrences.entries()) {
      if (lines.length <= 1) continue;
      const [fieldName] = fieldAndType.split(":");
      const hasHeadingOccurrence = lines.some((line) => headingLines.has(line));
      const hasBodyOccurrence = lines.some((line) => !headingLines.has(line));
      warnings.push({
        code: "DUPLICATED_FIELD",
        message:
          hasHeadingOccurrence && hasBodyOccurrence
            ? `Il campo ${fieldName} e duplicato tra titolo e corpo`
            : `Il campo ${fieldName} e usato piu volte`,
        fieldName,
        line: lines[1] ?? lines[0] ?? 1,
        blocking: true,
      });
    }
    return warnings;
  }

  private detectPlaceholderInHeadings(
    content: string,
    _tokenRefs: TokenLineRef[],
  ): TemplateValidationIssue[] {
    const issues: TemplateValidationIssue[] = [];
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index] ?? "";
      if (!/^\s{0,3}#{1,6}\s+/.test(line)) continue;
      const tokens = line.match(TOKEN_REGEX) ?? [];
      for (const token of tokens) {
        const headingContent = line.replace(/^\s{0,3}#{1,6}\s+/, "").trim();
        const isSingleTokenHeading = headingContent === token;
        let suggestion: string | undefined;
        if (isSingleTokenHeading) {
          const parsed = this.placeholderService.parseTypedPlaceholder(token);
          if (parsed.valid && parsed.name) {
            const staticTitle = titleFromFieldName(parsed.name);
            if (staticTitle) {
              suggestion = `### ${staticTitle}\n${token}`;
            }
          }
        }
        issues.push({
          code: "PLACEHOLDER_IN_TITLE",
          message:
            "Placeholders are not allowed in Markdown titles. Put plain title text and move placeholder to body.",
          line: index + 1,
          blocking: false,
          severity: "warning",
          placeholder: token,
          suggestion,
          autoFixable: Boolean(suggestion),
        });
      }
    }
    return issues;
  }

  private detectTableSplitWarning(content: string): TemplateValidationIssue[] {
    const lines = content.split(/\r?\n/);
    const warnings: TemplateValidationIssue[] = [];
    for (let i = 2; i < lines.length; i++) {
      const prev = lines[i - 1]?.trim() ?? "";
      const curr = lines[i]?.trim() ?? "";
      if (
        prev.startsWith("|") &&
        prev.endsWith("|") &&
        curr.startsWith("|") &&
        curr.endsWith("|") &&
        !/^\|(?:\s*:?-+:?\s*\|)+$/.test(prev) &&
        prev.split("|").length <= 4 &&
        curr.split("|").length <= 3
      ) {
        warnings.push({
          code: "TABLE_ROW_SPLIT",
          message:
            "Possible split markdown table row detected (likely truncated output). Regenerate or increase token limit.",
          line: i + 1,
          blocking: true,
          severity: "error",
          autoFixable: false,
        });
        break;
      }
    }
    return warnings;
  }

  private detectRedundantFieldDeclarations(
    content: string,
  ): TemplateValidationIssue[] {
    const warnings: TemplateValidationIssue[] = [];
    const lines = content.split(/\r?\n/);
    const headingRegex = /^\s{0,3}#{2,6}\s+(.+)$/;
    const sections: Array<{ title: string; start: number; end: number }> = [];

    for (let i = 0; i < lines.length; i++) {
      const match = (lines[i] ?? "").match(headingRegex);
      if (!match) continue;
      const title = (match[1] ?? "").trim();
      const nextHeadingIndex = lines
        .slice(i + 1)
        .findIndex((candidate) => headingRegex.test(candidate));
      const end =
        nextHeadingIndex >= 0 ? i + 1 + nextHeadingIndex - 1 : lines.length - 1;
      sections.push({ title, start: i + 1, end });
    }

    const collectFieldNames = (slice: string[]) =>
      (slice.join("\n").match(TOKEN_REGEX) ?? [])
        .map((token) => this.placeholderService.parseTypedPlaceholder(token))
        .filter((parsed) => parsed.valid && parsed.name)
        .map((parsed) => parsed.name as string);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!/^\s*campi\b/i.test(section.title)) continue;
      const sectionLines = lines.slice(section.start, section.end + 1);
      const campiNames = collectFieldNames(sectionLines);
      if (campiNames.length === 0) continue;
      const prevSection = sections[i - 1];
      if (!prevSection) continue;
      const prevLines = lines.slice(prevSection.start, prevSection.end + 1);
      const prevNames = new Set(collectFieldNames(prevLines));

      for (const fieldName of campiNames) {
        if (!prevNames.has(fieldName)) continue;
        warnings.push({
          code: "REDUNDANT_FIELD_DECLARATION",
          message: `Redundant field declaration in section "${section.title}": "${fieldName}" is already declared in previous content.`,
          line: section.start + 1,
          blocking: false,
          severity: "warning",
          fieldName,
          autoFixable: false,
        });
      }
    }
    return warnings;
  }

  private normalizeHeading(value: string): string {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private inferAuditDocumentType(
    content: string,
    expectedDocumentType?: AuditDocumentType,
  ): AuditDocumentType | null {
    if (expectedDocumentType) return expectedDocumentType;
    const inferred = this.intentClassifier.infer(content).archetype;
    if (
      inferred === "project_charter" ||
      inferred === "capitolato" ||
      inferred === "verbale" ||
      inferred === "report" ||
      inferred === "project_plan" ||
      inferred === "scheda" ||
      inferred === "checklist" ||
      inferred === "requirements_document" ||
      inferred === "policy" ||
      inferred === "procedure" ||
      inferred === "generic_template"
    ) {
      return inferred;
    }
    const normalized = this.normalizeHeading(content);
    if (normalized.includes("project charter")) return "project_charter";
    if (
      normalized.includes("verbale") ||
      normalized.includes("ordine del giorno") ||
      normalized.includes("prossima riunione")
    ) {
      return "verbale";
    }
    if (
      normalized.includes("capitolato") ||
      normalized.includes("fornitura") ||
      normalized.includes("requisiti tecnici")
    ) {
      return "capitolato";
    }
    if (
      normalized.includes("report economico") ||
      (normalized.includes("report") &&
        (normalized.includes("ricavi") ||
          normalized.includes("costi") ||
          normalized.includes("margini")))
    ) {
      return "report";
    }
    if (
      normalized.includes("scheda assicurativa") ||
      (normalized.includes("polizza") && normalized.includes("massimali"))
    ) {
      return "scheda";
    }
    if (
      normalized.includes("checklist") ||
      normalized.includes("voci di controllo")
    ) {
      return "checklist";
    }
    if (
      normalized.includes("piano operativo") ||
      normalized.includes("piano di progetto")
    ) {
      return "project_plan";
    }
    return null;
  }

  private extractMarkdownSections(content: string): Array<{
    title: string;
    normalizedTitle: string;
    startLine: number;
    lines: string[];
  }> {
    const lines = content.split(/\r?\n/);
    const headingRegex = /^\s{0,3}#{1,6}\s+(.+)$/;
    const headings = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => headingRegex.test(line));

    return headings.map((heading, index) => {
      const title = heading.line.match(headingRegex)?.[1]?.trim() ?? "";
      const end =
        index + 1 < headings.length ? headings[index + 1].index : lines.length;
      return {
        title,
        normalizedTitle: this.normalizeHeading(title),
        startLine: heading.index + 1,
        lines: lines.slice(heading.index + 1, end),
      };
    });
  }

  private matchesRequiredSection(
    title: string,
    requiredSection: { aliases: string[] },
  ): boolean {
    const normalizedTitle = this.normalizeHeading(title);
    return requiredSection.aliases.some((alias) =>
      normalizedTitle.includes(this.normalizeHeading(alias)),
    );
  }

  private detectMissingRequiredSectionsByDocumentType(
    content: string,
    documentType: AuditDocumentType | null,
  ): TemplateValidationIssue[] {
    if (!documentType) return [];
    const profile = DOCUMENT_REQUIRED_PROFILES[documentType];
    if (!profile || profile.sections.length === 0) return [];
    const sections = this.extractMarkdownSections(content);
    const issues: TemplateValidationIssue[] = [];
    for (const requiredSection of profile.sections) {
      const found = sections.some((section) =>
        this.matchesRequiredSection(section.title, requiredSection),
      );
      if (found) continue;
      issues.push({
        code: "MISSING_REQUIRED_SECTION",
        message: `Missing required section for "${documentType}": ${requiredSection.label}`,
        line: 1,
        blocking: true,
        severity: "error",
        fieldName: requiredSection.label,
        autoFixable: false,
      });
    }
    return issues;
  }

  private detectMissingRequiredTablesByDocumentType(
    content: string,
    documentType: AuditDocumentType | null,
  ): TemplateValidationIssue[] {
    if (!documentType) return [];
    const profile = DOCUMENT_REQUIRED_PROFILES[documentType];
    if (!profile || profile.sections.length === 0) return [];
    const sections = this.extractMarkdownSections(content);
    const isTableRow = (line: string) => {
      const trimmed = line.trim();
      return trimmed.startsWith("|") && trimmed.endsWith("|");
    };
    const isSeparatorRow = (line: string) =>
      /^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim());
    const hasTableWithPlaceholder = (lines: string[]) => {
      for (let index = 0; index < lines.length - 1; index++) {
        const header = lines[index] ?? "";
        const separator = lines[index + 1] ?? "";
        if (!isTableRow(header) || !isSeparatorRow(separator)) continue;
        const bodyRows = lines.slice(index + 2).filter(isTableRow);
        if (bodyRows.some((row) => Boolean(row.match(TOKEN_REGEX)))) {
          return true;
        }
      }
      return false;
    };
    const extractTableHeaders = (lines: string[]): string[] => {
      for (let index = 0; index < lines.length - 1; index++) {
        const header = lines[index] ?? "";
        const separator = lines[index + 1] ?? "";
        if (!isTableRow(header) || !isSeparatorRow(separator)) continue;
        return header
          .split("|")
          .map((chunk) => chunk.trim())
          .filter(Boolean);
      }
      return [];
    };
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const issues: TemplateValidationIssue[] = [];
    for (const requiredSection of profile.sections) {
      if (!requiredSection.requiresTable) continue;
      const section = sections.find((candidate) =>
        this.matchesRequiredSection(candidate.title, requiredSection),
      );
      if (!section || hasTableWithPlaceholder(section.lines)) continue;
      issues.push({
        code: "MISSING_REQUIRED_TABLE",
        message: `Missing required Markdown table for "${documentType}" section: ${requiredSection.label}`,
        line: section.startLine,
        blocking: true,
        severity: "error",
        fieldName: requiredSection.label,
        autoFixable: false,
      });
    }
    for (const requiredSection of profile.sections) {
      if (
        !requiredSection.requiresTable ||
        !requiredSection.requiredTableHeaders
      )
        continue;
      const section = sections.find((candidate) =>
        this.matchesRequiredSection(candidate.title, requiredSection),
      );
      if (!section) continue;
      const headers = extractTableHeaders(section.lines).map(normalize);
      if (headers.length === 0) continue;
      const missingHeaders = requiredSection.requiredTableHeaders.filter(
        (expected: string) =>
          !headers.some((actual) => actual.includes(normalize(expected))),
      );
      if (missingHeaders.length === 0) continue;
      issues.push({
        code: "MISSING_TABLE_COLUMNS",
        message: `Section "${requiredSection.label}" has incomplete table columns. Missing: ${missingHeaders.join(", ")}`,
        line: section.startLine,
        blocking: true,
        severity: "error",
        fieldName: requiredSection.label,
        autoFixable: false,
      });
    }
    return issues;
  }

  private detectDuplicatedSections(
    content: string,
    documentType: AuditDocumentType | null,
  ): TemplateValidationIssue[] {
    const lines = content.split(/\r?\n/);
    const headingRegex = /^\s{0,3}#{1,6}\s+(.+)$/;
    const seen = new Map<string, number>();
    const warnings: TemplateValidationIssue[] = [];
    const projectCharter = documentType === "project_charter";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const match = line.match(headingRegex);
      if (!match) continue;
      const rawTitle = (match[1] ?? "").trim();
      if (!rawTitle) continue;
      const normalized = this.normalizeHeading(rawTitle);

      const firstLine = seen.get(normalized);
      if (firstLine === undefined) {
        seen.set(normalized, i + 1);
        continue;
      }

      warnings.push({
        code: "DUPLICATED_SECTION",
        message: `Duplicated section title "${rawTitle}" (first occurrence at line ${firstLine}).`,
        line: i + 1,
        blocking: false,
        severity: "warning",
        autoFixable: false,
      });
    }

    return warnings;
  }

  private detectDuplicatedConsecutiveTitles(
    content: string,
  ): TemplateValidationIssue[] {
    const lines = content.split(/\r?\n/);
    const headingRegex = /^\s{0,3}#{1,6}\s+(.+)$/;
    const issues: TemplateValidationIssue[] = [];
    let previousNormalized: string | null = null;
    let previousLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const match = line.match(headingRegex);
      if (!match) continue;
      const currentTitle = (match[1] ?? "").trim();
      const normalized = this.normalizeHeading(currentTitle);
      if (previousNormalized && normalized === previousNormalized) {
        issues.push({
          code: "DUPLICATED_CONSECUTIVE_TITLE",
          message: `Consecutive duplicated title "${currentTitle}" (previous at line ${previousLine}).`,
          line: i + 1,
          blocking: true,
          severity: "error",
          autoFixable: false,
        });
      }
      previousNormalized = normalized;
      previousLine = i + 1;
    }

    return issues;
  }

  private detectTextPlaceholdersInTables(
    content: string,
    tokenRefs: TokenLineRef[],
  ): TemplateValidationIssue[] {
    const lines = content.split(/\r?\n/);
    const warnings: TemplateValidationIssue[] = [];
    const isTableRow = (line: string) => {
      const trimmed = line.trim();
      return trimmed.startsWith("|") && trimmed.endsWith("|");
    };
    const isSeparatorRow = (line: string) =>
      /^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim());

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (!isTableRow(line) || isSeparatorRow(line)) continue;
      const tokens = line.match(TOKEN_REGEX) ?? [];
      for (const token of tokens) {
        const parsed = this.placeholderService.parseTypedPlaceholder(token);
        if (!parsed.valid || parsed.type !== "text") continue;
        warnings.push({
          code: "TEXT_PLACEHOLDER_IN_TABLE",
          message:
            "Text placeholders inside Markdown tables are fragile. Prefer string or move long text outside the table.",
          line: tokenRefs.find((ref) => ref.token === token)?.line ?? i + 1,
          blocking: false,
          severity: "warning",
          placeholder: token,
          autoFixable: false,
        });
      }
    }
    return warnings;
  }

  private detectOutputTruncated(
    issues: TemplateValidationIssue[],
  ): TemplateValidationIssue[] {
    const hasTruncatedSignals = issues.some(
      (issue) =>
        issue.code === "UNCLOSED_PLACEHOLDER" ||
        issue.code === "TABLE_ROW_SPLIT",
    );
    if (!hasTruncatedSignals) return [];
    return [
      {
        code: "OUTPUT_TRUNCATED",
        message:
          "Output appears truncated before completion. Regenerate the template or increase token limit.",
        line: 1,
        blocking: true,
        severity: "error",
        autoFixable: false,
      },
    ];
  }

  private detectSemanticInconsistencies(
    fields: Array<{ name: string; type: string; line: number }>,
    documentType: AuditDocumentType | null,
  ): TemplateValidationIssue[] {
    const issues: TemplateValidationIssue[] = [];
    const byName = new Map(fields.map((field) => [field.name, field]));
    for (const field of fields) {
      if (
        /(giorni|days|durata_giorni)/i.test(field.name) &&
        field.type !== "integer"
      ) {
        issues.push({
          code: "INVALID_TYPE",
          message: `Field "${field.name}" should be integer for day-count semantics, found "${field.type}"`,
          line: field.line,
          blocking: true,
          severity: "error",
          fieldName: field.name,
          autoFixable: false,
        });
      }
      if (/(probabilita|probability)/i.test(field.name)) {
        const accepted = new Set(["percentage", "integer"]);
        if (!accepted.has(field.type)) {
          issues.push({
            code: "INVALID_TYPE",
            message: `Field "${field.name}" should be percentage/integer, found "${field.type}"`,
            line: field.line,
            blocking: true,
            severity: "error",
            fieldName: field.name,
            autoFixable: false,
          });
        }
      }
    }
    if (documentType === "verbale") {
      const actionFields = fields.filter((field) =>
        /azione|action_item/i.test(field.name),
      );
      const hasAction = actionFields.length > 0;
      const hasResponsible = [...byName.keys()].some((name) =>
        /responsabile.*azione|owner.*action|action_item_responsabile/i.test(
          name,
        ),
      );
      const hasDeadline = [...byName.keys()].some((name) =>
        /scadenza.*azione|due_date|data_azione/i.test(name),
      );
      if (hasAction && (!hasResponsible || !hasDeadline)) {
        issues.push({
          code: "INVALID_FORMAT",
          message:
            "Verbale inconsistente: action item presenti senza responsabile e/o scadenza associata.",
          line: actionFields[0]?.line ?? 1,
          blocking: true,
          severity: "error",
          autoFixable: false,
        });
      }
    }
    return issues;
  }

  private detectProfileContamination(
    content: string,
    documentType: AuditDocumentType | null,
  ): TemplateValidationIssue[] {
    if (!documentType) return [];
    const sections = this.extractMarkdownSections(content);
    const headingsNormalized = sections.map((s) =>
      this.normalizeHeading(s.title),
    );
    const antiPatterns =
      DOCUMENT_BLUEPRINTS[documentType]?.antiPatterns?.map((item: string) =>
        item.trim(),
      ) ?? [];
    const markers = antiPatterns.flatMap((pattern: string) => {
      const inParen = pattern.match(/\(([^)]+)\)/)?.[1];
      if (!inParen) return [];
      return inParen
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean);
    });
    const found = markers.filter((marker: string) => {
      const normalizedMarker = this.normalizeHeading(marker);
      return headingsNormalized.some((heading: string) =>
        heading.includes(normalizedMarker),
      );
    });
    if (found.length === 0) return [];
    return [
      {
        code: "PROFILE_CONTAMINATION",
        message: `Detected profile contamination for "${documentType}": remove non-pertinent sections (${found.join(", ")}).`,
        line: 1,
        blocking: true,
        severity: "error",
        autoFixable: false,
      },
    ];
  }

  private extractTokenFromMessage(message: string): string | null {
    const match = message.match(/(\{\{[^{}\n]*\}\})/);
    return match?.[1] ?? null;
  }

  private buildIssueDedupKey(issue: TemplateValidationIssue): string {
    const severity = issue.severity ?? "error";
    const section = issue.fieldName ?? "";
    const missingColumnsMatch = issue.message.match(/Missing:\s*(.+)$/i);
    const missingColumns = missingColumnsMatch
      ? missingColumnsMatch[1]
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean)
          .sort()
          .join("|")
      : "";
    return [
      severity,
      issue.code,
      section.toLowerCase(),
      missingColumns,
      (issue.placeholder ?? "").toLowerCase(),
      issue.message.toLowerCase(),
    ].join("::");
  }

  private dedupeIssues(
    issues: TemplateValidationIssue[],
  ): TemplateValidationIssue[] {
    const unique = new Map<string, TemplateValidationIssue>();
    for (const issue of issues) {
      const key = this.buildIssueDedupKey(issue);
      if (!unique.has(key)) unique.set(key, issue);
    }
    return [...unique.values()];
  }

  validateDeterministic(
    content: string,
    expectedDocumentType?: AuditDocumentType,
  ): DeterministicValidationReport {
    const started = Date.now();
    const documentType = this.inferAuditDocumentType(
      content,
      expectedDocumentType,
    );
    const tokenRefs = this.collectTokensWithLine(content);
    const parseResult = this.placeholderService.parse(content);
    const fieldsByName = new Map<string, ParsedTemplatePlaceholder>();
    for (const field of parseResult.fields) {
      if (!fieldsByName.has(field.name)) fieldsByName.set(field.name, field);
    }

    const errors: TemplateValidationIssue[] = [];
    errors.push(...this.detectUnbalancedBraces(content));
    errors.push(
      ...parseResult.errors.map((message) => {
        const tokenFromMessage = this.extractTokenFromMessage(message) ?? "";
        const line = this.findLineByToken(tokenRefs, tokenFromMessage);
        const placeholderCandidate =
          tokenFromMessage ||
          tokenRefs.find((ref) => ref.line === line)?.token ||
          undefined;
        return this.parseErrorToIssue(message, line, placeholderCandidate);
      }),
    );

    const warnings: TemplateValidationIssue[] = [];
    warnings.push(...this.detectDuplicateWarnings(content, tokenRefs));
    warnings.push(...this.detectRedundantFieldDeclarations(content));
    warnings.push(...this.detectMissingTypeWarnings(parseResult, tokenRefs));
    warnings.push(...this.detectPlaceholderInHeadings(content, tokenRefs));
    warnings.push(...this.detectTableSplitWarning(content));
    warnings.push(
      ...this.detectMissingRequiredSectionsByDocumentType(
        content,
        documentType,
      ),
    );
    warnings.push(
      ...this.detectMissingRequiredTablesByDocumentType(content, documentType),
    );
    warnings.push(...this.detectDuplicatedSections(content, documentType));
    warnings.push(...this.detectDuplicatedConsecutiveTitles(content));
    warnings.push(...this.detectTextPlaceholdersInTables(content, tokenRefs));
    warnings.push(
      ...this.detectNonCanonicalPlaceholderForm(content, tokenRefs),
    );

    errors.push(...this.detectOutputTruncated([...errors, ...warnings]));

    const fields = [...fieldsByName.values()].map((field) => ({
      name: field.name,
      type: field.type,
      line: this.findLineByToken(tokenRefs, field.raw),
    }));

    const officialTypes = new Set(
      this.placeholderService.getOfficialSupportedTemplateTypes(),
    );
    for (const field of fields) {
      if (!officialTypes.has(field.type)) {
        errors.push({
          code: "INVALID_TYPE",
          message: `Invalid type "${field.type}" for field "${field.name}": not in official supported types`,
          line: field.line,
          blocking: true,
          severity: "error",
          placeholder:
            tokenRefs.find((ref) => ref.line === field.line)?.token ??
            undefined,
          fieldName: field.name,
          autoFixable: false,
        });
      }
    }
    errors.push(...this.detectSemanticInconsistencies(fields, documentType));
    errors.push(...this.detectProfileContamination(content, documentType));

    const dedupedWarnings = this.dedupeIssues(warnings);
    const dedupedErrors = this.dedupeIssues([
      ...errors,
      ...dedupedWarnings.filter((warning) => warning.blocking),
    ]);

    return {
      errors: dedupedErrors,
      warnings: dedupedWarnings,
      fields,
      durationMs: Date.now() - started,
    };
  }

  private detectNonCanonicalPlaceholderForm(
    content: string,
    tokenRefs: Array<{ token: string; line: number }>,
  ): TemplateValidationIssue[] {
    const issues: TemplateValidationIssue[] = [];
    for (const ref of tokenRefs) {
      const token = ref.token;
      if (!/^\{\{[a-z]+:[a-z_][a-z0-9_]*.*\}\}$/.test(token)) continue;
      const parsed = this.placeholderService.parseTypedPlaceholder(token);
      if (!parsed || parsed.type === "list") continue;
      const hasExtended = /:\d+:(true|false)\}\}$/.test(token);
      if (hasExtended) continue;
      issues.push({
        code: "NON_CANONICAL_PLACEHOLDER_FORM",
        message:
          "Placeholder non canonico: usare la forma estesa {{tipo:nome:maxLength:required}}.",
        line: ref.line,
        blocking: false,
        severity: "warning",
        placeholder: token,
        fieldName: parsed.name,
        autoFixable: false,
      });
    }
    return issues;
  }

  async audit(input: TemplateAuditInput): Promise<TemplateAuditReport> {
    const deterministic = this.validateDeterministic(
      input.content,
      input.expectedDocumentType,
    );
    if (input.runAi === false) {
      return { deterministic, ai: null };
    }
    if (deterministic.errors.some((error) => error.blocking)) {
      return {
        deterministic,
        ai: {
          warnings: [],
          provider: "skipped",
          model: null,
          latencyMs: 0,
          failed: true,
          error:
            "AI semantic review skipped: template contains blocking syntax errors.",
        },
      };
    }

    const parsed = this.placeholderService.parse(input.content);
    const ai = await this.aiTemplateAuditorService.auditTemplate(
      input.content,
      parsed.fields,
    );

    return { deterministic, ai };
  }
}
