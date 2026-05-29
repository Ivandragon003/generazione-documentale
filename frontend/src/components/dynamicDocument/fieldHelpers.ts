import type { ApiTemplateField, FieldRow, FieldValue } from "../../data/api";

export function fieldOptions(field: ApiTemplateField) {
  if (field.options?.length) return field.options;
  if (!field.defaultValue) return [];
  return field.defaultValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((value) => ({ label: value, value }));
}

export function updateRowValue(
  rows: FieldRow[],
  rowIndex: number,
  columnName: string,
  value: FieldValue,
): FieldRow[] {
  return rows.map((row, index) =>
    index === rowIndex ? { ...row, [columnName]: value } : row,
  );
}

export function removeRow(rows: FieldRow[], rowIndex: number): FieldRow[] {
  return rows.filter((_, index) => index !== rowIndex);
}

export function asRows(value: FieldValue | undefined): FieldRow[] {
  return Array.isArray(value) ? value : [];
}

export function valueForInput(value: FieldValue | undefined): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

export function resolveHtmlInputType(type: ApiTemplateField["type"]): string {
  switch (type) {
    case "currency":
    case "percentage":
      // Keep these as text to prevent browser scientific notation inputs
      // such as "1e3", which are not desirable for document fields.
      return "text";
    case "number":
      return "number";
    case "integer":
      // Keep integer as text input to avoid browser transient number states
      // (e.g. "e", "+", locale separators) that cause UI flicker.
      return "text";
    case "date":
      return "date";
    case "email":
      return "email";
    case "url":
      return "url";
    case "tel":
    case "phone":
      return "tel";
    default:
      return "text";
  }
}

export function isNumericFieldType(type: ApiTemplateField["type"]): boolean {
  return (
    type === "number" ||
    type === "integer" ||
    type === "currency" ||
    type === "percentage"
  );
}

export function parseNumberOrEmpty(raw: string): number | "" {
  if (raw.trim() === "") return "";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : "";
}

export function isStrictNumericInput(
  raw: string,
  type: ApiTemplateField["type"],
): boolean {
  if (raw.trim() === "") return true;
  if (type === "integer") return /^-?\d+$/.test(raw);
  if (type === "number" || type === "currency" || type === "percentage") {
    return /^-?\d+([.,]\d+)?$/.test(raw);
  }
  return true;
}

export function isChecked(value: FieldValue | undefined): boolean {
  return value === true || value === "true";
}
