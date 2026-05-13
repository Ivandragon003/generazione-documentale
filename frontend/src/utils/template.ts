import type {
  ApiTemplateField,
  FieldRow,
  FieldType,
  FieldValue,
  FieldValueMap,
} from "../data/api";

export const PLACEHOLDER_REGEX =
  /\{\{\s*([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_]+))?\s*\}\}/g;

export type NormalizedField = Required<
  Pick<
    ApiTemplateField,
    "name" | "label" | "type" | "required" | "defaultValue"
  >
> &
  Omit<
    ApiTemplateField,
    "name" | "label" | "type" | "required" | "defaultValue"
  >;

const supportedTypes = new Set<FieldType>([
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "checkbox",
  "email",
  "url",
  "tel",
  "select",
  "currency",
  "table",
  "subtable",
  "list",
  "repeater",
]);

export function labelFromName(name: string): string {
  return name
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function extractPlaceholders(markdown: string): string[] {
  const matches = markdown.matchAll(PLACEHOLDER_REGEX);
  return [...new Set([...matches].map((match) => match[1]).filter(Boolean))];
}

export function extractInlineFieldTypes(
  markdown: string,
): Map<string, FieldType> {
  const result = new Map<string, FieldType>();
  for (const match of markdown.matchAll(PLACEHOLDER_REGEX)) {
    const name = match[1];
    const type = match[2];
    if (!name) continue;
    result.set(
      name,
      supportedTypes.has(type as FieldType) ? (type as FieldType) : "text",
    );
  }
  return result;
}

export function normalizeFieldDefinitions(
  markdown: string,
  fields: ApiTemplateField[] = [],
): NormalizedField[] {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const inlineTypes = extractInlineFieldTypes(markdown);
  return extractPlaceholders(markdown).map((name) => {
    const source = byName.get(name);
    const type = source?.type ?? inlineTypes.get(name) ?? "text";
    return {
      ...source,
      name,
      label: source?.label?.trim() || labelFromName(name),
      type: supportedTypes.has(type) ? type : "text",
      required: source?.required ?? true,
      defaultValue: source?.defaultValue ?? "",
      placeholder: source?.placeholder,
      options: source?.options,
      columns: source?.columns,
    };
  });
}

export function defaultValueForField(field: ApiTemplateField): FieldValue {
  const type = field.type ?? "text";
  if (type === "boolean" || type === "checkbox") {
    return field.defaultValue === "true";
  }
  if (type === "number") {
    return field.defaultValue ? Number(field.defaultValue) : "";
  }
  if (
    type === "table" ||
    type === "subtable" ||
    type === "list" ||
    type === "repeater"
  ) {
    return [];
  }
  return field.defaultValue ?? "";
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
    if (field.required !== false && isMissing(values[field.name])) {
      errors[field.name] = "Campo obbligatorio";
    }
  }
  return errors;
}

export function stringifyFieldValue(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) return `${value.length} righe`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function comparePlaceholderSets(previous: string[], next: string[]) {
  const prev = new Set(previous);
  const curr = new Set(next);
  const added = next.filter((key) => !prev.has(key));
  const removed = previous.filter((key) => !curr.has(key));
  const unchanged = added.length === 0 && removed.length === 0;
  return { added, removed, unchanged };
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
