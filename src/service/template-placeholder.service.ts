import { Injectable } from "@nestjs/common";
import type {
  FieldColumnDefinition,
  FieldDefinition,
  FieldOption,
  FieldType,
} from "../common/types/field-definition.type";
import type { TemplateSyntaxSpec } from "./ai/ai-provider.interface";

export type FieldPrimitive = string | number | boolean | null;
export interface FieldRow {
  [key: string]: FieldValue;
}
export type FieldValue = FieldPrimitive | FieldRow | FieldRow[];
export type FieldValueMap = Record<string, FieldValue>;

export interface MarkdownValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fields: FieldDefinition[];
}

export interface ParsedTemplatePlaceholder {
  raw: string;
  type: FieldType;
  name: string;
  maxLength?: number;
  required?: boolean;
  listName?: string;
  listLabel?: string;
  listValues?: string[];
}

export interface ParseTemplateResult {
  fields: ParsedTemplatePlaceholder[];
  errors: string[];
  legacyUntypedNames: string[];
}

export interface FieldValuesValidationResult {
  valid: boolean;
  errors: string[];
  issues?: FieldSuggestionIssue[];
}

export interface UnresolvedFieldReport {
  name: string;
  type: FieldType;
  required: boolean;
  reason: "missing";
  field?: string;
  suggestedField?: string;
  distance?: number;
  code?: "UNKNOWN_FIELD";
}

export interface FieldSuggestionIssue {
  field: string;
  suggestedField?: string;
  distance: number | null;
  code: "UNKNOWN_FIELD" | "UNKNOWN_PLACEHOLDER";
  reason: string;
}

export interface FieldSuggestion {
  suggestedField?: string;
  distance: number | null;
}

export interface RenderTemplateResult {
  result: string;
  unresolved: string[];
}

export interface TemplateSyntaxVariantDescriptor {
  id: "legacy" | "strict" | "lengthOnly" | "extended" | "extendedList";
  format: string;
  example: string;
}

export interface TemplateSyntaxProfileDescriptor {
  fieldNamePattern: string;
  supportedTypes: FieldType[];
  variants: TemplateSyntaxVariantDescriptor[];
}

export interface PartialFieldDefinition {
  name: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
  placeholder?: string;
  listName?: string;
  listLabel?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}

const TEMPLATE_PLACEHOLDER_TOKEN_REGEX = /\{\{[^{}\n]*\}\}/g;
const RENDER_PLACEHOLDER_REGEX = /\{\{([^{}\n]+)\}\}/g;
const STRICT_TYPED_PLACEHOLDER_REGEX = /^\{\{([a-z]+):([a-z_][a-z0-9_]*)\}\}$/;
const LENGTH_TYPED_PLACEHOLDER_REGEX =
  /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+)\}\}$/;
const EXTENDED_TYPED_PLACEHOLDER_REGEX =
  /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+):(true|false)(?::([^:{}\n]+)(?::([^{}]*))?)?\}\}$/;
const TYPED_PLACEHOLDER_PARTS_REGEX = /^\{\{([a-z]+):([^\s{}:][^{}]*)\}\}$/;
const GENERIC_TYPED_PLACEHOLDER_REGEX = /^\{\{([^:\s{}]+):([^{}\s]*)\}\}$/;
const LEGACY_UNTYPED_PLACEHOLDER_REGEX = /^\{\{([a-z_][a-z0-9_]*)\}\}$/;
const FIELD_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;

const normalizeTechnicalName = (raw: string): string =>
  raw
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

const OFFICIAL_LIST_FORMAT =
  "{{list:field_name:length:required:label,value_a,value_b}}";

const OFFICIAL_LIST_EXAMPLE =
  "{{list:nome_campo:100:true:Etichetta campo,opzione1,opzione2,opzione3}}";

export const primaryTemplateFieldTypes = [
  "string",
  "text",
  "date",
  "currency",
  "integer",
  "boolean",
  "percentage",
  "list",
] as const satisfies readonly FieldType[];

export const legacyTemplateFieldTypes = [
  "number",
  "email",
  "phone",
] as const satisfies readonly FieldType[];

export const allowedTemplateFieldTypes = [
  ...primaryTemplateFieldTypes,
  ...legacyTemplateFieldTypes,
] as const satisfies readonly FieldType[];

function resolveOfficialTemplateFieldTypes(): FieldType[] {
  const fromEnv = (process.env.TEMPLATE_OFFICIAL_TYPES?.trim() ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const validFromEnv = fromEnv.filter((item): item is FieldType =>
    (allowedTemplateFieldTypes as readonly string[]).includes(item),
  );
  if (validFromEnv.length > 0) return validFromEnv;
  return [...allowedTemplateFieldTypes] as FieldType[];
}

export const allowedFieldTypes: FieldType[] = [
  ...allowedTemplateFieldTypes,
  "textarea",
  "checkbox",
  "url",
  "tel",
  "select",
  "table",
  "subtable",
  "list",
  "repeater",
];

const allowedTemplateTypeSet = new Set<string>(allowedTemplateFieldTypes);
const allowedFieldTypeSet = new Set<string>(allowedFieldTypes);
const isTemplateFieldType = (value: string): value is FieldType =>
  allowedTemplateTypeSet.has(value);

const labelFromName = (name: string): string => {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const isEmptyValue = (value: FieldValue | undefined): boolean =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && value.length === 0);

const hasFieldValue = (value: FieldValue | undefined): value is FieldValue =>
  !isEmptyValue(value);

const parseNumeric = (value: FieldValue): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const normalized = normalizeNumericString(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeNumericString = (value: string): string | null => {
  const normalized = value.trim().replace(/\s/g, "");
  if (normalized.length === 0) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    return normalizeWithDecimalSeparator(normalized, decimalSeparator);
  }
  if (lastComma >= 0) {
    return /^\d{1,3}(,\d{3})+$/.test(normalized)
      ? normalized.replaceAll(",", "")
      : normalized.replace(",", ".");
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    return normalized.replaceAll(".", "");
  }
  return normalized;
};

const normalizeWithDecimalSeparator = (
  value: string,
  decimalSeparator: "," | ".",
): string => {
  const thousandsSeparator = decimalSeparator === "," ? "." : ",";
  return value
    .replaceAll(thousandsSeparator, "")
    .replace(decimalSeparator, ".");
};

const parseBoolean = (value: FieldValue): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
};

const parseDate = (value: FieldValue): Date | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", String.raw`\|`).replaceAll(/\r?\n/g, "<br>");
}

function damerauLevenshteinDistance(left: string, right: string): number {
  const leftLength = left.length;
  const rightLength = right.length;
  const distances: number[][] = Array.from({ length: leftLength + 1 }, () =>
    Array.from({ length: rightLength + 1 }, () => 0),
  );

  for (let i = 0; i <= leftLength; i++) distances[i][0] = i;
  for (let j = 0; j <= rightLength; j++) distances[0][j] = j;

  for (let i = 1; i <= leftLength; i++) {
    for (let j = 1; j <= rightLength; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      distances[i][j] = Math.min(
        distances[i - 1][j] + 1,
        distances[i][j - 1] + 1,
        distances[i - 1][j - 1] + cost,
      );

      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        distances[i][j] = Math.min(
          distances[i][j],
          distances[i - 2][j - 2] + 1,
        );
      }
    }
  }

  return distances[leftLength][rightLength];
}

function maxSuggestionDistance(value: string): number {
  if (value.length < 5) return 1;
  return Math.min(2, Math.floor(value.length * 0.25));
}

@Injectable()
export class TemplatePlaceholderService {
  private buildCanonicalPromptExamples(types: FieldType[]): string[] {
    const examplesByType: Partial<Record<FieldType, string>> = {
      string: "{{string:nome_progetto:120:true}}",
      text: "{{text:descrizione_progetto:1000:true}}",
      date: "{{date:data_inizio:10:true}}",
      currency: "{{currency:budget_preliminare:12:true}}",
      integer: "{{integer:durata_giorni:3:false}}",
      boolean: "{{boolean:approvato:5:true}}",
      percentage: "{{percentage:probabilita_rischio_1:5:true}}",
      list: "{{list:nome:80:true:nome_lista,Opzione1,Opzione2,Opzione3}}",
      number: "{{number:valore_stimato:10:false}}",
      email: "{{email:contatto_email:120:true}}",
      phone: "{{phone:contatto_telefonico:30:false}}",
      textarea: "{{text:note_estese:2000:false}}",
      checkbox: "{{boolean:conferma_utente:5:true}}",
      url: "{{string:url_riferimento:200:false}}",
      tel: "{{phone:telefono_contatto:30:false}}",
      select: "{{list:categoria:80:true:categorie,CategoriaA,CategoriaB}}",
      repeater: "{{list:elementi:80:true:elementi,Elemento1,Elemento2}}",
    };

    return types
      .map((type) => examplesByType[type])
      .filter((example): example is string => Boolean(example));
  }

  describeTemplateSyntaxProfile(): TemplateSyntaxProfileDescriptor {
    const candidates: TemplateSyntaxVariantDescriptor[] = [
      {
        id: "strict",
        format: "{{type:field_name}}",
        example: "{{string:nome_cliente}}",
      },
      {
        id: "lengthOnly",
        format: "{{type:field_name:length}}",
        example: "{{string:nome_cliente:120}}",
      },
      {
        id: "extended",
        format: "{{type:field_name:length:required}}",
        example: "{{string:nome_cliente:120:true}}",
      },
      {
        id: "extendedList",
        format: OFFICIAL_LIST_FORMAT,
        example:
          "{{list:tipologia_contratto:80:true:Tipologia contratto,Servizi,Forniture}}",
      },
      {
        id: "legacy",
        format: "{{field_name}}",
        example: "{{nome_cliente}}",
      },
    ];

    const variants = candidates.filter(
      (candidate) => this.parse(candidate.example).errors.length === 0,
    );

    return {
      fieldNamePattern: FIELD_NAME_REGEX.source,
      supportedTypes: this.getOfficialSupportedTemplateTypes(),
      variants,
    };
  }

  getOfficialSupportedTemplateTypes(): FieldType[] {
    return resolveOfficialTemplateFieldTypes();
  }

  buildTemplateSyntaxSpec(): TemplateSyntaxSpec {
    const profile = this.describeTemplateSyntaxProfile();
    const canonicalExamples = this.buildCanonicalPromptExamples(
      profile.supportedTypes,
    );
    const compactGrammar = [
      "TEMPLATE PLACEHOLDER GRAMMAR",
      "- Usa solo questa sintassi parser.",
      `- field_name regex: ${profile.fieldNamePattern}`,
      `- Tipi ufficiali: ${profile.supportedTypes.join(", ")}`,
      "- length: intero positivo, solo cifre.",
      "- required: true|false (minuscolo).",
      `- list: solo formato ufficiale ${OFFICIAL_LIST_FORMAT}; esempio ${OFFICIAL_LIST_EXAMPLE}.`,
      "- list label: testo descrittivo obbligatorio, senza due punti.",
      "- list options: ultimo parametro obbligatorio in formato CSV label,opzione1,opzione2.",
      "- label e valori CSV sono ammessi solo per placeholder di tipo list.",
      "- Per tipi non-list usa solo {{type:field_name}}, {{type:field_name:length}} o {{type:field_name:length:required}}.",
      "- NON generare placeholder vuoti: {{}} non e valido.",
      "- table/subtable NON sono tipi placeholder supportati (UNSUPPORTED_TYPE).",
      "- Per le tabelle usa Markdown normale con placeholder validi nelle celle.",
      "- NON usare mai placeholder nei titoli Markdown (#, ##, ###, ...).",
      "- I titoli devono essere testo statico leggibile, non compilabile.",
      "- Ogni sezione deve avere: titolo statico -> breve spiegazione descrittiva in italiano -> campi compilabili.",
      "- Evita ridondanza: non ripetere lo stesso placeholder piu volte nella stessa sezione senza motivo.",
      "- Scegli UNA sola modalita per i campi compilabili nella stessa sezione: o elenco 'Campi compilabili' o placeholder nel corpo, mai entrambe.",
      "- Le tabelle vanno scritte in Markdown con placeholder validi nelle celle.",
      "- Evita note finali fuori template (es. 'Questo template e progettato...', 'Ricorda di...').",
      "- Sezione 'Autorita del Project Manager': descrivi poteri, limiti decisionali e autorita concessa; non usare campi contatto.",
      "- Esempi validi:",
      ...canonicalExamples.map((example) => `  - ${example}`),
      "  - | Nome | Ruolo | Responsabilita |",
      "    |------|-------|----------------|",
      "    | {{string:nome_stakeholder_1}} | {{string:ruolo_stakeholder_1}} | {{text:responsabilita_stakeholder_1}} |",
      "  - ### Descrizione del progetto",
      "    Descrivere il problema/opportunita che motiva il progetto e gli obiettivi di business attesi.",
      "    Spiegare quali informazioni servono a sponsor e stakeholder per valutare priorita, impatto e urgenza.",
      "    {{text:descrizione_progetto}}",
      "  - ### Autorita del Project Manager",
      "    Indicare in modo descrittivo i poteri decisionali e i limiti autorizzativi del project manager.",
      "    {{text:autorita_project_manager}}",
      "  - | Ambito decisionale | Autorita concessa | Limiti |",
      "    |--------------------|-------------------|--------|",
      "    | {{string:ambito_decisionale_1}} | {{text:autorita_concessa_1}} | {{text:limiti_decisionali_1}} |",
      "- Esempi non validi:",
      "  - ### {{text:descrizione_progetto}}",
      "  - ### {{string:nome_progetto}}",
      "  - {{string:nome cliente}}",
      "  - {{string:unità_responsabile}}",
      "  - placeholder di tipo table o subtable",
      "  - {{string:nome_cliente:length:true}}",
      "  - {{list:obiettivi:length:true:Obiettivi}}",
      "  - {{string:nome_cliente:100:true:stati_cliente:Attivo,Sospeso}}",
      "  - {{}}",
      "  - {{list:priorita:50:required:livelli_priorita,Bassa,Media,Alta}}",
      "  - {{list:stato:20:true:Stato}}",
      "  - ripetere placeholder identici nella sezione 'Campi' se gia presenti nel corpo",
      "  - {{string:nome_authorita}}",
      "  - {{string:email_authorita}}",
      "  - {{string:telefono_authorita}}",
      "- Errori comuni da evitare:",
      "  - parametri inventati",
      "  - tipi fuori lista ufficiale",
      "  - usare la parola `length` invece di un numero",
      "  - accenti/maiuscole/spazi nei field_name",
    ].join("\n");

    return {
      version: "template-syntax-spec-v1",
      parserVersion: process.env.PARSER_VERSION?.trim() || null,
      supportedTypes: [...profile.supportedTypes],
      compactGrammar,
      canonicalExamples,
    };
  }

  parseTypedPlaceholder(token: string) {
    return this.validatePlaceholderToken(token);
  }

  suggestFieldName(fieldName: string, candidates: string[]): FieldSuggestion {
    const normalizedField = fieldName.trim().toLowerCase();
    const uniqueCandidates = [...new Set(candidates.map((item) => item.trim()))]
      .filter(Boolean)
      .filter((candidate) => candidate.toLowerCase() !== normalizedField);
    if (!normalizedField || uniqueCandidates.length === 0) {
      return { distance: null };
    }

    const ranked = uniqueCandidates
      .map((candidate) => ({
        candidate,
        distance: damerauLevenshteinDistance(
          normalizedField,
          candidate.toLowerCase(),
        ),
      }))
      .sort((left, right) => left.distance - right.distance);

    const best = ranked[0];
    if (!best || best.distance > maxSuggestionDistance(normalizedField)) {
      return { distance: null };
    }

    const second = ranked[1];
    if (second && second.distance - best.distance < 2) {
      return { distance: best.distance };
    }

    return { suggestedField: best.candidate, distance: best.distance };
  }

  extractTemplateFields(content: string): ParsedTemplatePlaceholder[] {
    return this.parse(content).fields;
  }

  getUnknownPlaceholderReports(
    content: string,
    knownFields: Array<{ name: string }>,
  ): FieldSuggestionIssue[] {
    const knownNames = knownFields.map((field) => field.name);
    const knownNameSet = new Set(knownNames);
    return this.parse(content)
      .fields.filter((field) => !knownNameSet.has(field.name))
      .map((field) =>
        this.buildFieldSuggestionIssue(
          field.name,
          knownNames,
          "UNKNOWN_PLACEHOLDER",
        ),
      );
  }

  private buildInvalidTypeMessage(token: string, type: string): string {
    const suggestion = this.suggestFieldName(type, [...allowedTemplateTypeSet]);
    if (suggestion.suggestedField) {
      return `Invalid placeholder type: "${type}". Did you mean "${suggestion.suggestedField}"?`;
    }
    return `Invalid placeholder ${token}: unsupported type "${type}"`;
  }

  private parseLengthOnlyPlaceholder(
    token: string,
    match: RegExpExecArray,
  ): ReturnType<TemplatePlaceholderService["validatePlaceholderToken"]> {
    const type = match[1];
    const name = match[2];
    const maxLength = Number.parseInt(match[3] ?? "0", 10);
    if (!isTemplateFieldType(type)) {
      return {
        valid: false,
        error: this.buildInvalidTypeMessage(token, type),
      };
    }
    if (type === "list") {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: list requires format ${OFFICIAL_LIST_FORMAT}`,
      };
    }
    if (!Number.isFinite(maxLength) || maxLength <= 0) {
      return {
        valid: false,
        error: `Invalid length: "${match[3]}". It must be a number.`,
      };
    }
    return {
      valid: true,
      type,
      name,
      maxLength,
    };
  }

  private parseMalformedTypedPlaceholder(
    token: string,
  ): ReturnType<TemplatePlaceholderService["validatePlaceholderToken"]> | null {
    const typedMatch = TYPED_PLACEHOLDER_PARTS_REGEX.exec(token);
    if (!typedMatch) return null;

    const type = typedMatch[1] ?? "";
    const rawParts = (typedMatch[2] ?? "")
      .split(":")
      .map((part) => part.trim());
    if (!isTemplateFieldType(type)) {
      return {
        valid: false,
        error: this.buildInvalidTypeMessage(token, type),
      };
    }
    const name = rawParts[0] ?? "";
    if (!FIELD_NAME_REGEX.test(name)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: field_name must be snake_case and cannot start with a number`,
      };
    }
    if (rawParts.length >= 2) {
      const rawLength = rawParts[1] ?? "";
      if (!/^\d+$/.test(rawLength)) {
        return {
          valid: false,
          error: `Invalid length: "${rawLength}". It must be a number.`,
        };
      }
    }
    if (rawParts.length >= 3) {
      const rawRequired = (rawParts[2] ?? "").toLowerCase();
      if (rawRequired !== "true" && rawRequired !== "false") {
        return {
          valid: false,
          error: `Invalid required value: "${rawParts[2]}". Use true or false.`,
        };
      }
    }
    return null;
  }

  private parseExtendedPlaceholder(
    token: string,
    match: RegExpExecArray,
  ): ReturnType<TemplatePlaceholderService["validatePlaceholderToken"]> {
    const type = match[1];
    const name = match[2];
    const maxLength = Number.parseInt(match[3] ?? "0", 10);
    const requiredToken = (match[4] ?? "false").toLowerCase();
    const required = requiredToken === "true";
    const rawListPayload = match[5]?.trim();
    const legacyRawListValues = match[6];
    if (!isTemplateFieldType(type)) {
      return {
        valid: false,
        error: this.buildInvalidTypeMessage(token, type),
      };
    }
    if (!Number.isFinite(maxLength) || maxLength <= 0) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: length must be a positive integer`,
      };
    }
    if (type !== "list") {
      if (rawListPayload || legacyRawListValues !== undefined) {
        return {
          valid: false,
          error: `Invalid placeholder ${token}: label and list options are only allowed for list placeholders`,
        };
      }
      return {
        valid: true,
        type,
        name,
        maxLength,
        required,
      };
    }
    const csvParts =
      legacyRawListValues !== undefined
        ? [
            rawListPayload ?? "",
            ...legacyRawListValues.split(",").map((value) => value.trim()),
          ]
        : (rawListPayload ?? "").split(",").map((value) => value.trim());
    const listLabel = csvParts[0]?.trim() ?? "";
    const listValues = csvParts
      .slice(1)
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, items) => items.indexOf(value) === index);
    if (!listLabel) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: list label is required`,
      };
    }
    const listName = normalizeTechnicalName(listLabel);
    if (!listName || !FIELD_NAME_REGEX.test(listName)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: list label must produce a valid technical name`,
      };
    }
    if (listValues.length === 0) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: list options are required`,
      };
    }
    return {
      valid: true,
      type,
      name,
      maxLength,
      required,
      listName,
      listLabel,
      listValues,
    };
  }

  private parseStrictPlaceholder(
    token: string,
    match: RegExpExecArray,
  ): ReturnType<TemplatePlaceholderService["validatePlaceholderToken"]> {
    const type = match[1];
    const name = match[2];
    if (!isTemplateFieldType(type)) {
      return {
        valid: false,
        error: this.buildInvalidTypeMessage(token, type),
      };
    }
    if (type === "list") {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: list requires format ${OFFICIAL_LIST_FORMAT}`,
      };
    }
    return { valid: true, type, name };
  }

  private parseGenericTypedPlaceholder(
    token: string,
    match: RegExpExecArray,
  ): ReturnType<TemplatePlaceholderService["validatePlaceholderToken"]> {
    const rawType = match[1] ?? "";
    const rawName = match[2] ?? "";
    if (!/^[a-z]+$/.test(rawType)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: type must be lowercase`,
      };
    }
    if (!isTemplateFieldType(rawType)) {
      return {
        valid: false,
        error: this.buildInvalidTypeMessage(token, rawType),
      };
    }
    if (!FIELD_NAME_REGEX.test(rawName)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: field_name must be snake_case and cannot start with a number`,
      };
    }
    return { valid: true, type: rawType, name: rawName };
  }

  private tryMergeSplitRow(
    lines: string[],
    row: number,
    expectedCells: number,
  ): boolean {
    const current = lines[row] ?? "";
    if (!this.isTableRow(current) || this.isSeparatorRow(current)) return false;
    const next = lines[row + 1] ?? "";
    if (!this.isTableRow(next) || this.isSeparatorRow(next)) return false;

    const currentCells = this.tableCellCount(current);
    const nextCells = this.tableCellCount(next);
    if (currentCells !== expectedCells - 1 || nextCells !== 1) return false;

    const nextInner = next.trim().slice(1, -1).trim();
    lines[row] = `${current.trim().slice(0, -1).trimEnd()} | ${nextInner} |`;
    lines.splice(row + 1, 1);
    return true;
  }

  private buildFieldSuggestionIssue(
    fieldName: string,
    candidates: string[],
    code: FieldSuggestionIssue["code"],
  ): FieldSuggestionIssue {
    const suggestion = this.suggestFieldName(fieldName, candidates);
    return {
      field: fieldName,
      suggestedField: suggestion.suggestedField,
      distance: suggestion.distance,
      code,
      reason:
        code === "UNKNOWN_FIELD"
          ? "Field value does not match any template field"
          : "Placeholder does not match any known field",
    };
  }

  validateFieldValue(
    field: Pick<
      ParsedTemplatePlaceholder,
      "name" | "type" | "required" | "maxLength" | "listValues"
    >,
    value: FieldValue | undefined,
  ): string | null {
    if (field.required && isEmptyValue(value)) {
      return `Missing required field "${field.name}"`;
    }
    if (isEmptyValue(value)) return null;
    if (!hasFieldValue(value)) return null;
    if (!this.isValidValueForType(field.type, value)) {
      return `Invalid value for field "${field.name}" of type "${field.type}"`;
    }
    if (
      field.maxLength &&
      typeof value === "string" &&
      value.length > field.maxLength
    ) {
      return `Field "${field.name}" exceeds maxLength ${field.maxLength}`;
    }
    if (
      field.type === "list" &&
      field.listValues &&
      field.listValues.length > 0 &&
      typeof value === "string" &&
      !field.listValues.includes(value)
    ) {
      return `Invalid list value for field "${field.name}"`;
    }
    return null;
  }

  private isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith("|") && trimmed.endsWith("|");
  }

  private isSeparatorRow(line: string): boolean {
    return /^\|(?:\s*:?-+:?\s*\|)+$/.test(line.trim());
  }

  private tableCellCount(line: string): number {
    const trimmed = line.trim();
    if (!this.isTableRow(trimmed)) return 0;
    const inner = trimmed.slice(1, -1);
    return inner.length === 0 ? 0 : inner.split("|").length;
  }

  private repairSplitTableRows(content: string): string {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length - 1; i++) {
      const header = lines[i] ?? "";
      const separator = lines[i + 1] ?? "";
      if (!this.isTableRow(header) || !this.isSeparatorRow(separator)) continue;

      const expectedCells = this.tableCellCount(header);
      if (expectedCells <= 1) continue;

      for (let row = i + 2; row < lines.length - 1; row++) {
        const current = lines[row] ?? "";
        if (!this.isTableRow(current) || this.isSeparatorRow(current)) break;
        if (this.tryMergeSplitRow(lines, row, expectedCells)) {
          row--;
        }
      }
    }
    return lines.join("\n");
  }

  isFieldType(value: string | undefined): value is FieldType {
    return Boolean(value && allowedFieldTypeSet.has(value));
  }

  private validatePlaceholderToken(token: string): {
    valid: boolean;
    type?: FieldType;
    name?: string;
    maxLength?: number;
    required?: boolean;
    listName?: string;
    listLabel?: string;
    listValues?: string[];
    legacyUntyped?: boolean;
    error?: string;
  } {
    const extendedMatch = EXTENDED_TYPED_PLACEHOLDER_REGEX.exec(token);
    if (extendedMatch) {
      return this.parseExtendedPlaceholder(token, extendedMatch);
    }

    const lengthOnlyMatch = LENGTH_TYPED_PLACEHOLDER_REGEX.exec(token);
    if (lengthOnlyMatch) {
      return this.parseLengthOnlyPlaceholder(token, lengthOnlyMatch);
    }

    if (/\s/.test(token)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: spaces are not allowed`,
      };
    }

    const strictMatch = STRICT_TYPED_PLACEHOLDER_REGEX.exec(token);
    if (strictMatch) {
      return this.parseStrictPlaceholder(token, strictMatch);
    }

    const legacyMatch = LEGACY_UNTYPED_PLACEHOLDER_REGEX.exec(token);
    if (legacyMatch) {
      const name = legacyMatch[1];
      return {
        valid: true,
        type: "string",
        name,
        legacyUntyped: true,
      };
    }

    const malformedTyped = this.parseMalformedTypedPlaceholder(token);
    if (malformedTyped) {
      return malformedTyped;
    }

    const genericMatch = GENERIC_TYPED_PLACEHOLDER_REGEX.exec(token);
    if (genericMatch) {
      return this.parseGenericTypedPlaceholder(token, genericMatch);
    }

    return {
      valid: false,
      error: `Invalid placeholder ${token}: expected format {{type:field_name}} or {{type:field_name:length:required}}`,
    };
  }

  parse(content: string): ParseTemplateResult {
    const errors: string[] = [];
    const fields: ParsedTemplatePlaceholder[] = [];
    const legacyUntypedNames: string[] = [];
    const byName = new Map<string, FieldType>();
    const tokens = content.match(TEMPLATE_PLACEHOLDER_TOKEN_REGEX) ?? [];

    for (const token of tokens) {
      const validation = this.validatePlaceholderToken(token);
      if (!validation.valid || !validation.type || !validation.name) {
        if (validation.error) errors.push(validation.error);
        continue;
      }

      const existingType = byName.get(validation.name);
      if (validation.legacyUntyped) {
        if (!existingType) {
          byName.set(validation.name, "string");
          fields.push({
            raw: token,
            type: "string",
            name: validation.name,
          });
        }
        legacyUntypedNames.push(validation.name);
        continue;
      }

      if (!existingType) {
        byName.set(validation.name, validation.type);
        fields.push({
          raw: token,
          type: validation.type,
          name: validation.name,
          maxLength: validation.maxLength,
          required: validation.required,
          listName: validation.listName,
          listLabel: validation.listLabel,
          listValues: validation.listValues,
        });
        continue;
      }

      if (existingType !== validation.type) {
        errors.push(
          `Conflicting placeholder types for field "${validation.name}": "${existingType}" and "${validation.type}"`,
        );
      }
    }

    return { fields, errors, legacyUntypedNames };
  }

  extractFieldNames(content: string): string[] {
    return this.parse(content).fields.map((field) => field.name);
  }

  normalizeFieldDefinitions(
    content: string,
    inputFields: PartialFieldDefinition[] = [],
  ): FieldDefinition[] {
    const placeholders = this.parse(content).fields;
    const providedByName = new Map(
      inputFields.map((field) => [field.name, field]),
    );

    return placeholders.map((placeholder) => {
      const provided = providedByName.get(placeholder.name);

      return {
        name: placeholder.name,
        label:
          provided?.label ??
          (placeholder.type === "list" && placeholder.listLabel
            ? placeholder.listLabel
            : labelFromName(placeholder.name)),
        type: placeholder.type,
        required: provided?.required ?? placeholder.required ?? true,
        maxLength: provided?.maxLength ?? placeholder.maxLength,
        defaultValue: provided?.defaultValue ?? "",
        source: "template",
        placeholder: provided?.placeholder,
        listName: provided?.listName ?? placeholder.listName,
        listLabel: provided?.listLabel ?? placeholder.listLabel,
        options:
          provided?.options ??
          placeholder.listValues?.map((value) => ({ label: value, value })),
        columns: provided?.columns,
      };
    });
  }

  validateMarkdownContent(
    content: string,
    maxBytes: number,
  ): MarkdownValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (
      !content ||
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return {
        valid: false,
        errors: ["Template content cannot be empty"],
        warnings,
        fields: [],
      };
    }

    if (Buffer.byteLength(content, "utf8") > maxBytes) {
      errors.push(`Template too large. Limit: ${maxBytes} byte`);
    }

    const openCount = (content.match(/\{\{/g) ?? []).length;
    const closeCount = (content.match(/\}\}/g) ?? []).length;
    if (openCount !== closeCount) {
      errors.push("Unbalanced placeholder braces detected: check {{ and }}");
    }

    const parsed = this.parse(content);
    errors.push(...parsed.errors);

    const blockedPatterns: Array<{ pattern: RegExp; label: string }> = [
      {
        pattern:
          /\\(?:input|include|write18)(?=\s|[^a-z]|$)|\\(?:openout|read)(?=[^a-z]|$)/i,
        label: "LaTeX input/output commands",
      },
      { pattern: /<script\b/i, label: "HTML script tag" },
      { pattern: /<iframe\b/i, label: "HTML iframe tag" },
    ];
    const blockedMatches = blockedPatterns
      .filter((candidate) => candidate.pattern.test(content))
      .map((candidate) => candidate.label);

    if (blockedMatches.length > 0) {
      errors.push(
        `Security blocked content detected: ${blockedMatches.join(", ")}`,
      );
    }

    const fields = this.normalizeFieldDefinitions(content);
    if (parsed.legacyUntypedNames.length > 0) {
      const uniqueLegacyNames = [...new Set(parsed.legacyUntypedNames)];
      warnings.push(
        `Legacy placeholders without explicit type detected: ${uniqueLegacyNames.join(", ")}. They are treated as {{string:field_name}}.`,
      );
    }
    if (fields.length === 0) {
      warnings.push(
        "No dynamic fields found. Use placeholders such as {{string:title}}",
      );
    }

    if (!/^#\s+.+/m.test(content)) {
      warnings.push(
        "No Markdown H1 title found. Add a line like # {{string:title}}",
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fields,
    };
  }

  validateFieldValues(
    content: string,
    fieldValues: FieldValueMap,
  ): FieldValuesValidationResult {
    const errors: string[] = [];
    const parsed = this.parse(content);

    if (parsed.errors.length > 0) {
      return { valid: false, errors: parsed.errors };
    }

    const knownFieldNames = parsed.fields.map((field) => field.name);
    const knownFieldNameSet = new Set(knownFieldNames);
    const issues = Object.keys(fieldValues)
      .filter((fieldName) => !knownFieldNameSet.has(fieldName))
      .map((fieldName) =>
        this.buildFieldSuggestionIssue(
          fieldName,
          knownFieldNames,
          "UNKNOWN_FIELD",
        ),
      );

    for (const field of parsed.fields) {
      const value = fieldValues[field.name];
      const required = this.isRequiredForGeneration(field);
      if (required && isEmptyValue(value)) {
        errors.push(`Missing required field "${field.name}"`);
        continue;
      }
      if (!hasFieldValue(value)) continue;
      if (!this.isValidValueForType(field.type, value)) {
        errors.push(
          `Invalid value for field "${field.name}" of type "${field.type}"`,
        );
        continue;
      }
      if (
        field.maxLength &&
        typeof value === "string" &&
        value.length > field.maxLength
      ) {
        errors.push(
          `Field "${field.name}" exceeds maxLength ${field.maxLength}`,
        );
      }
      if (
        field.type === "list" &&
        field.listValues &&
        field.listValues.length > 0 &&
        typeof value === "string" &&
        !field.listValues.includes(value)
      ) {
        errors.push(`Invalid list value for field "${field.name}"`);
      }
    }

    return { valid: errors.length === 0, errors, issues };
  }

  getUnresolvedRequiredFields(
    content: string,
    fieldValues: FieldValueMap,
  ): UnresolvedFieldReport[] {
    const parsed = this.parse(content);
    if (parsed.errors.length > 0) return [];

    return parsed.fields
      .filter((field) => this.isRequiredForGeneration(field))
      .filter((field) => isEmptyValue(fieldValues[field.name]))
      .map((field) => {
        const candidateIssue = Object.keys(fieldValues)
          .map((fieldName) => {
            const suggestion = this.suggestFieldName(fieldName, [field.name]);
            return { fieldName, suggestion };
          })
          .find((item) => item.suggestion.suggestedField === field.name);

        return {
          name: field.name,
          type: field.type,
          required: true,
          reason: "missing",
          field: candidateIssue?.fieldName,
          suggestedField: candidateIssue?.suggestion.suggestedField,
          distance:
            candidateIssue?.suggestion.distance === null
              ? undefined
              : candidateIssue?.suggestion.distance,
          code: candidateIssue ? "UNKNOWN_FIELD" : undefined,
        };
      });
  }

  private isRequiredForGeneration(field: ParsedTemplatePlaceholder): boolean {
    if (field.required !== undefined) return field.required;
    return !LEGACY_UNTYPED_PLACEHOLDER_REGEX.test(field.raw);
  }

  render(
    content: string,
    fieldValues: FieldValueMap,
    strict: boolean,
  ): RenderTemplateResult {
    const normalizedContent = this.repairSplitTableRows(content);
    const unresolved: string[] = [];
    const placeholderCache = new Map<
      string,
      { type: FieldType; name: string } | null
    >();
    const result = normalizedContent.replace(
      RENDER_PLACEHOLDER_REGEX,
      (match, rawKey: string) => {
        let placeholder = placeholderCache.get(match);
        if (!placeholderCache.has(match)) {
          placeholder = this.parseRenderPlaceholder(match, rawKey);
          placeholderCache.set(match, placeholder);
        }
        if (!placeholder) {
          return `[Invalid placeholder: ${rawKey}]`;
        }

        const value = fieldValues[placeholder.name];
        if (isEmptyValue(value)) {
          unresolved.push(placeholder.name);
          return strict ? "" : match;
        }

        const rendered = this.formatValue(placeholder.type, value);
        if (rendered.length === 0) {
          unresolved.push(placeholder.name);
          return strict ? "" : match;
        }
        return rendered;
      },
    );
    return { result, unresolved };
  }

  private parseRenderPlaceholder(
    match: string,
    rawKey: string,
  ): { type: FieldType; name: string } | null {
    const tokenValidation = this.validatePlaceholderToken(match);
    if (tokenValidation.valid && tokenValidation.type && tokenValidation.name) {
      return { type: tokenValidation.type, name: tokenValidation.name };
    }

    const parts = rawKey.split(":").map((part) => part.trim());
    if (parts.length === 2 && this.isFieldType(parts[0])) {
      const normalizedName = parts[1]
        ?.toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      if (normalizedName && FIELD_NAME_REGEX.test(normalizedName)) {
        return { type: parts[0], name: normalizedName };
      }
    }
    if (parts.length === 1 && FIELD_NAME_REGEX.test(parts[0] ?? "")) {
      return { type: "string", name: parts[0] };
    }
    return null;
  }

  private isValidValueForType(type: FieldType, value: FieldValue): boolean {
    switch (type) {
      case "currency":
      case "number":
      case "percentage":
        return parseNumeric(value) !== null;
      case "integer": {
        const numeric = parseNumeric(value);
        return numeric !== null && Number.isInteger(numeric);
      }
      case "boolean":
        return parseBoolean(value) !== null;
      case "date":
        return parseDate(value) !== null;
      case "email":
        return (
          typeof value === "string" &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        );
      case "phone":
        return (
          typeof value === "string" &&
          /^[+\d\s()./-]+$/.test(value.trim()) &&
          value.replace(/\D/g, "").length >= 3
        );
      case "text":
      case "string":
      case "list":
        return !Array.isArray(value) && typeof value !== "object";
      default:
        return true;
    }
  }

  private formatValue(type: FieldType, value: FieldValue): string {
    switch (type) {
      case "boolean": {
        const parsed = parseBoolean(value);
        if (parsed === null) {
          return this.scalarToString(value);
        }
        return parsed ? "Yes" : "No";
      }
      case "date": {
        const parsed = parseDate(value);
        if (parsed) {
          return new Intl.DateTimeFormat("en-US", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(parsed);
        }
        return this.scalarToString(value);
      }
      case "currency":
        return this.formatNumericValue(value, "€");
      case "percentage":
        return this.formatNumericValue(value, "%");
      case "number":
        return this.formatNumericValue(value);
      default:
        return this.scalarToString(value);
    }
  }

  private formatNumber(value: number): string {
    const sign = value < 0 ? "-" : "";
    const ungrouped = new Intl.NumberFormat("en-US", {
      useGrouping: false,
      maximumFractionDigits: 20,
    }).format(Math.abs(value));
    const [integerPart = "0", decimalPart] = ungrouped.split(".");
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const decimalSuffix = decimalPart ? `.${decimalPart}` : "";
    return sign + groupedInteger + decimalSuffix;
  }

  private formatNumericValue(value: FieldValue, suffix = ""): string {
    const parsed = parseNumeric(value);
    if (parsed === null) {
      return this.scalarToString(value);
    }
    return this.formatNumber(parsed) + suffix;
  }
  private scalarToString(value: FieldValue | undefined): string {
    if (value === undefined || value === null) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return this.tableToMarkdown(value);
    if (typeof value === "object") {
      return Object.entries(value)
        .map(
          ([key, nestedValue]) =>
            `- ${key}: ${this.scalarToString(nestedValue)}`,
        )
        .join("\n");
    }
    return String(value);
  }

  private tableToMarkdown(rows: FieldRow[]): string {
    if (rows.length === 0) return "";

    const columns = [
      ...new Set(rows.flatMap((row) => Object.keys(row))),
    ].filter(Boolean);
    if (columns.length === 0) return "";

    const header = `| ${columns.map(escapeMarkdownCell).join(" | ")} |`;
    const separator = `| ${columns.map(() => "---").join(" | ")} |`;
    const body = rows.map((row) => {
      const cells = columns.map((column) =>
        escapeMarkdownCell(this.scalarToString(row[column])),
      );
      return `| ${cells.join(" | ")} |`;
    });
    return [header, separator, ...body].join("\n");
  }
}
