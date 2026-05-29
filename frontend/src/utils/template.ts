import type {
  ApiTemplateField,
  FieldRow,
  FieldType,
  FieldValue,
  FieldValueMap,
} from "../data/api";

export const PLACEHOLDER_REGEX = /\{\{[^{}\n]*\}\}/g;

export type NormalizedField = Required<
  Pick<
    ApiTemplateField,
    "name" | "label" | "type" | "required" | "defaultValue"
  >
> &
  Omit<
    ApiTemplateField,
    "name" | "label" | "type" | "required" | "defaultValue"
  > & {
    rawPlaceholder?: string;
  };

const supportedTypes = new Set<FieldType>([
  "string",
  "text",
  "textarea",
  "number",
  "integer",
  "date",
  "boolean",
  "phone",
  "checkbox",
  "email",
  "url",
  "tel",
  "select",
  "currency",
  "percentage",
  "table",
  "subtable",
  "list",
  "repeater",
]);

export function isSupportedFieldType(
  type: string | undefined,
): type is FieldType {
  return Boolean(type && supportedTypes.has(type as FieldType));
}

export type PlaceholderDefinition = {
  raw: string;
  name: string;
  type: FieldType;
  maxLength?: number;
  required?: boolean;
  listName?: string;
  listLabel?: string;
  listValues?: string[];
  legacyUntyped?: boolean;
  invalidType?: string;
};

export type InvalidPlaceholderDiagnostic = {
  message: string;
};

const STRICT_TYPED_PLACEHOLDER_REGEX = /^\{\{([a-z]+):([a-z_][a-z0-9_]*)\}\}$/;
const LENGTH_TYPED_PLACEHOLDER_REGEX =
  /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+)\}\}$/;
const EXTENDED_TYPED_PLACEHOLDER_REGEX =
  /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+):(true|false)(?::([^:{}\n]+)(?::([^{}]*))?)?\}\}$/;
const TYPED_PLACEHOLDER_PARTS_REGEX = /^\{\{([a-z]+):([^\s{}:][^{}]*)\}\}$/;
const LEGACY_UNTYPED_PLACEHOLDER_REGEX = /^\{\{([a-z_][a-z0-9_]*)\}\}$/;
const FIELD_NAME_REGEX = /^[a-z_][a-z0-9_]*$/;
const allowedTemplateTypeSet: ReadonlySet<string> = new Set([
  "string",
  "text",
  "date",
  "currency",
  "integer",
  "boolean",
  "percentage",
  "list",
  "number",
  "email",
  "phone",
]);

export function normalizeFieldName(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseInvalidTypedDiagnostic(
  token: string,
): InvalidPlaceholderDiagnostic | null {
  const typedMatch = TYPED_PLACEHOLDER_PARTS_REGEX.exec(token);
  if (!typedMatch) return null;
  const rawType = typedMatch[1] ?? "";
  const payload = typedMatch[2] ?? "";
  if (!allowedTemplateTypeSet.has(rawType)) {
    return {
      message: `Invalid placeholder type: "${rawType}".`,
    };
  }
  const parts = payload.split(":").map((part) => part.trim());
  const name = parts[0] ?? "";
  if (!FIELD_NAME_REGEX.test(name)) {
    return {
      message:
        "Invalid placeholder format. Invalid field name (snake_case required).",
    };
  }
  if (parts.length >= 2 && !/^\d+$/.test(parts[1] ?? "")) {
    return {
      message: `Invalid length: "${parts[1]}". It must be a number.`,
    };
  }
  if (parts.length >= 3) {
    const required = (parts[2] ?? "").toLowerCase();
    if (required !== "true" && required !== "false") {
      return {
        message: `Invalid required value: "${parts[2]}". Use true or false.`,
      };
    }
  }
  return {
    message:
      "Invalid placeholder format. Valid formats: {{type:name}}, {{type:name:length}}, {{type:name:length:true|false}}.",
  };
}

export function parsePlaceholderToken(token: string): {
  field?: PlaceholderDefinition;
  invalid?: InvalidPlaceholderDiagnostic;
} {
  const strictMatch = STRICT_TYPED_PLACEHOLDER_REGEX.exec(token);
  if (strictMatch) {
    const type = strictMatch[1] ?? "";
    const name = strictMatch[2] ?? "";
    if (!allowedTemplateTypeSet.has(type)) {
      return {
        invalid: { message: `Invalid placeholder type: "${type}".` },
      };
    }
    return {
      field: {
        raw: token,
        name,
        type: type as FieldType,
      },
    };
  }

  const lengthMatch = LENGTH_TYPED_PLACEHOLDER_REGEX.exec(token);
  if (lengthMatch) {
    const type = lengthMatch[1] ?? "";
    const name = lengthMatch[2] ?? "";
    const maxLength = Number.parseInt(lengthMatch[3] ?? "0", 10);
    if (!allowedTemplateTypeSet.has(type)) {
      return {
        invalid: { message: `Invalid placeholder type: "${type}".` },
      };
    }
    return {
      field: {
        raw: token,
        name,
        type: type as FieldType,
        maxLength: Number.isFinite(maxLength) ? maxLength : undefined,
      },
    };
  }

  const extendedMatch = EXTENDED_TYPED_PLACEHOLDER_REGEX.exec(token);
  if (extendedMatch) {
    const type = extendedMatch[1] ?? "";
    const name = extendedMatch[2] ?? "";
    const maxLength = Number.parseInt(extendedMatch[3] ?? "0", 10);
    const requiredToken = (extendedMatch[4] ?? "").toLowerCase();
    const rawListPayload = extendedMatch[5]?.trim() || undefined;
    const legacyRawListValues = extendedMatch[6];
    const csvParts =
      legacyRawListValues !== undefined
        ? [
            rawListPayload ?? "",
            ...legacyRawListValues.split(",").map((value) => value.trim()),
          ]
        : (rawListPayload ?? "").split(",").map((value) => value.trim());
    const listLabel = csvParts[0]?.trim() || undefined;
    const listName = listLabel ? normalizeFieldName(listLabel) : undefined;
    const listValues = csvParts
      .slice(1)
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, items) => items.indexOf(value) === index);
    if (!allowedTemplateTypeSet.has(type)) {
      return {
        invalid: { message: `Invalid placeholder type: "${type}".` },
      };
    }
    if (type === "list") {
      if (!listLabel) {
        return {
          invalid: {
            message: "Invalid list placeholder: missing label.",
          },
        };
      }
      if (!listName || !FIELD_NAME_REGEX.test(listName)) {
        return {
          invalid: {
            message:
              "Invalid list placeholder: label must produce a valid technical name.",
          },
        };
      }
      if (listValues.length === 0) {
        return {
          invalid: { message: "Invalid list placeholder: missing options." },
        };
      }
    }
    if (
      type !== "list" &&
      (rawListPayload || legacyRawListValues !== undefined)
    ) {
      return {
        invalid: {
          message:
            "Invalid placeholder format: label and list options are only allowed for list placeholders.",
        },
      };
    }
    return {
      field: {
        raw: token,
        name,
        type: type as FieldType,
        maxLength: Number.isFinite(maxLength) ? maxLength : undefined,
        required: requiredToken === "true",
        listName,
        listLabel,
        listValues: listValues.length > 0 ? listValues : undefined,
      },
    };
  }

  const legacyMatch = LEGACY_UNTYPED_PLACEHOLDER_REGEX.exec(token);
  if (legacyMatch) {
    const name = legacyMatch[1] ?? "";
    return {
      field: {
        raw: token,
        name,
        type: "string",
        legacyUntyped: true,
      },
    };
  }

  const invalid = parseInvalidTypedDiagnostic(token);
  if (invalid) return { invalid };
  return {
    invalid: {
      message:
        "Invalid placeholder format. Valid formats: {{type:name}}, {{type:name:length}}, {{type:name:length:true|false}}.",
    },
  };
}

export function labelFromName(name: string): string {
  const parts = name.split("_").filter(Boolean);
  const numericIndex = parts.findIndex((part) => /^\d+$/.test(part));
  const formatText = (items: string[]): string =>
    items
      .map((part) => part.toLowerCase())
      .join(" ")
      .replace(/^./, (first) => first.toUpperCase());

  if (numericIndex > 0 && numericIndex < parts.length - 1) {
    const subject = `${formatText(parts.slice(0, numericIndex))} ${parts[numericIndex]}`;
    const suffix = formatText(parts.slice(numericIndex + 1));
    return `${subject} - ${suffix}`;
  }

  return formatText(parts);
}

export function extractPlaceholders(markdown: string): string[] {
  return extractPlaceholderDefinitions(markdown).map((field) => field.name);
}

export function extractPlaceholderDefinitions(
  markdown: string,
): PlaceholderDefinition[] {
  const byName = new Map<string, PlaceholderDefinition>();
  for (const match of markdown.matchAll(PLACEHOLDER_REGEX)) {
    const token = match[0];
    const parsed = parsePlaceholderToken(token);
    if (!parsed.field) continue;
    if (byName.has(parsed.field.name)) continue;
    byName.set(parsed.field.name, parsed.field);
  }
  return [...byName.values()];
}

export function normalizeFieldDefinitions(
  markdown: string,
  fields: ApiTemplateField[] = [],
): NormalizedField[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const normalized: NormalizedField[] = [];
  for (const placeholder of extractPlaceholderDefinitions(markdown)) {
    if (placeholder.invalidType) continue;
    const source = byName.get(placeholder.name);
    const type = placeholder.type ?? source?.type ?? "text";
    normalized.push({
      ...source,
      name: placeholder.name,
      label:
        source?.label?.trim() ||
        (placeholder.type === "list" && placeholder.listLabel
          ? placeholder.listLabel
          : labelFromName(placeholder.name)),
      type: supportedTypes.has(type) ? type : "text",
      required:
        source?.required ?? placeholder.required ?? !placeholder.legacyUntyped,
      maxLength: source?.maxLength ?? placeholder.maxLength,
      defaultValue: source?.defaultValue ?? "",
      placeholder: source?.placeholder,
      listName: source?.listName ?? placeholder.listName,
      rawPlaceholder: placeholder.raw,
      options:
        source?.options ??
        placeholder.listValues?.map((value) => ({ label: value, value })),
      columns: source?.columns,
    });
  }
  return normalized;
}

function defaultValueForField(field: ApiTemplateField): FieldValue {
  const type = field.type ?? "text";
  const defaultValue = isTemplateToken(field.defaultValue)
    ? ""
    : field.defaultValue;
  if (type === "boolean" || type === "checkbox") {
    return defaultValue === "true";
  }
  if (type === "number") {
    return defaultValue ? Number(defaultValue) : "";
  }
  if (type === "integer") {
    return defaultValue ? Number(defaultValue) : "";
  }
  if (type === "table" || type === "subtable" || type === "repeater") {
    return [];
  }
  return defaultValue ?? "";
}

function isTemplateToken(value: unknown): boolean {
  return typeof value === "string" && /^\{\{[^{}\n]+\}\}$/.test(value.trim());
}

export function initialFieldValues(fields: ApiTemplateField[]): FieldValueMap {
  return Object.fromEntries(
    fields.map((field) => [field.name, defaultValueForField(field)]),
  );
}

function isMissing(value: FieldValue | undefined): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function validateFieldValues(
  fields: ApiTemplateField[],
  values: FieldValueMap,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const currentValue = values[field.name];
    const type = field.type ?? "text";
    if (field.required !== false && isMissing(currentValue)) {
      errors[field.name] = "Required field";
      continue;
    }
    if (
      field.maxLength &&
      typeof currentValue === "string" &&
      currentValue.length > field.maxLength
    ) {
      errors[field.name] = `Max ${field.maxLength} chars`;
      continue;
    }
    if (
      (type === "number" ||
        type === "integer" ||
        type === "currency" ||
        type === "percentage") &&
      currentValue !== "" &&
      currentValue !== null &&
      currentValue !== undefined &&
      (typeof currentValue !== "number" || !Number.isFinite(currentValue))
    ) {
      errors[field.name] = "Invalid number";
      continue;
    }
    if (type === "date" && currentValue !== "" && currentValue !== null) {
      if (
        typeof currentValue !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(currentValue.trim())
      ) {
        errors[field.name] = "Invalid date";
      }
      continue;
    }
    if (
      (type === "boolean" || type === "checkbox") &&
      !isMissing(currentValue)
    ) {
      if (typeof currentValue !== "boolean") {
        errors[field.name] = "Invalid boolean";
      }
      continue;
    }
    if (type === "list" && !isMissing(currentValue)) {
      if (typeof currentValue !== "string") {
        errors[field.name] = "Invalid list value";
      }
    }
  }
  return errors;
}

export function stringifyFieldValue(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return `${value.length} rows`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseNumeric(value: FieldValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized
      .replaceAll(thousandsSeparator, "")
      .replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    normalized = /^\d{1,3}(,\d{3})+$/.test(normalized)
      ? normalized.replaceAll(",", "")
      : normalized.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replaceAll(".", "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const ungrouped = new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumFractionDigits: 20,
  }).format(Math.abs(value));
  const [integerPart = "0", decimalPart] = ungrouped.split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${groupedInteger}${decimalPart ? `.${decimalPart}` : ""}`;
}

function parseBoolean(value: FieldValue | undefined): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

export function formatFieldValueForPreview(
  type: FieldType | undefined,
  value: FieldValue | undefined,
): string {
  if (value === undefined || value === null || value === "") return "";
  if (type === "date") {
    if (typeof value !== "string") return stringifyFieldValue(value);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }
  if (type === "boolean" || type === "checkbox") {
    const parsed = parseBoolean(value);
    return parsed === null ? stringifyFieldValue(value) : parsed ? "Yes" : "No";
  }
  if (type === "currency") {
    const parsed = parseNumeric(value);
    return parsed === null
      ? stringifyFieldValue(value)
      : `${formatNumber(parsed)} \u20ac`;
  }
  if (type === "percentage") {
    const parsed = parseNumeric(value);
    return parsed === null
      ? stringifyFieldValue(value)
      : `${formatNumber(parsed)}%`;
  }
  if (type === "number" || type === "integer") {
    const parsed = parseNumeric(value);
    return parsed === null ? stringifyFieldValue(value) : formatNumber(parsed);
  }
  return stringifyFieldValue(value);
}

export function placeholderTokenForField(field: ApiTemplateField): string {
  const raw =
    (
      field as ApiTemplateField & { rawPlaceholder?: string }
    ).rawPlaceholder?.trim() ?? field.placeholder?.trim();
  PLACEHOLDER_REGEX.lastIndex = 0;
  if (raw && PLACEHOLDER_REGEX.test(raw)) {
    PLACEHOLDER_REGEX.lastIndex = 0;
    return raw;
  }
  PLACEHOLDER_REGEX.lastIndex = 0;
  return field.type ? `{{${field.type}:${field.name}}}` : `{{${field.name}}}`;
}

export function inputPlaceholderForField(
  field:
    | Pick<ApiTemplateField, "name" | "label" | "type" | "required">
    | undefined,
): string {
  if (!field) return "";
  const type = field.type ?? "text";
  const label = field.label?.trim() || labelFromName(field.name);
  switch (type) {
    case "string":
      return `Enter ${label}`;
    case "text":
    case "textarea":
      return "Enter a description...";
    case "date":
      return "Select a date";
    case "currency":
      return "E.g. 1,200.00";
    case "integer":
      return "E.g. 10";
    case "percentage":
      return "E.g. 22%";
    case "number":
      return "E.g. 10.5";
    case "email":
      return "name@company.com";
    case "phone":
    case "tel":
      return "+39 ...";
    case "boolean":
    case "checkbox":
      return "";
    case "list":
    case "select":
      return "Select a value";
    default:
      return `Enter ${label}`;
  }
}

export function fieldTypeHelperText(
  field: Pick<ApiTemplateField, "type"> | undefined,
  showTypeHint = false,
): string {
  if (!showTypeHint) return "";
  return field?.type ? `Type: ${field.type}` : "";
}

export function mergeFieldValues(
  current: FieldValueMap,
  nextDefaults: FieldValueMap,
): FieldValueMap {
  return { ...nextDefaults, ...current };
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
    )
    .join(",")}}`;
}

export function emptyRow(columns: ApiTemplateField[] = []): FieldRow {
  return Object.fromEntries(
    columns.map((column) => [column.name, defaultValueForField(column)]),
  );
}
