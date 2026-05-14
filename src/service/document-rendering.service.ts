import { Injectable } from "@nestjs/common";
import type { FieldDefinition } from "../common/types/field-definition.type";

export type FieldPrimitive = string | number | boolean | null;
export interface FieldRow {
  [key: string]: FieldValue;
}
export type FieldValue = FieldPrimitive | FieldRow | FieldRow[];
export type FieldValueMap = Record<string, FieldValue>;

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function scalarToString(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (Array.isArray(value)) return tableToMarkdown(value);
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => `- ${key}: ${scalarToString(nestedValue)}`)
      .join("\n");
  }
  return String(value);
}

function tableToMarkdown(rows: FieldRow[]): string {
  if (rows.length === 0) return "";

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    Boolean,
  );
  if (columns.length === 0) return "";

  const header = `| ${columns.map(escapeMarkdownCell).join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => {
    const cells = columns.map((column) =>
      escapeMarkdownCell(scalarToString(row[column])),
    );
    return `| ${cells.join(" | ")} |`;
  });
  return [header, separator, ...body].join("\n");
}

@Injectable()
export class DocumentRenderingService {
  renderTemplate(
    content: string,
    fieldValues: FieldValueMap,
    strict: boolean,
  ): { result: string; unresolved: string[] } {
    const unresolved: string[] = [];
    const result = content.replace(
      /\{\{([^}]+)\}\}/g,
      (match, rawKey: string) => {
        const parts = rawKey.split(":").map((part) => part.trim());
        const key = parts.length === 2 ? parts[1] : parts[0];
        const value = fieldValues[key];
        const rendered = scalarToString(value);
        if (rendered.length === 0) {
          unresolved.push(key);
          return strict ? "" : match;
        }
        return rendered;
      },
    );
    return { result, unresolved };
  }

  getMissingRequiredFields(
    fields: FieldDefinition[],
    fieldValues: FieldValueMap,
  ): string[] {
    return fields
      .filter((field) => {
        if (field.required === false) return false;
        const value = fieldValues[field.name];
        if (Array.isArray(value)) return value.length === 0;
        return (
          value === undefined ||
          value === null ||
          value === "" ||
          (typeof value === "object" && Object.keys(value).length === 0)
        );
      })
      .map((field) =>
        field.label && field.label.trim().length > 0 ? field.label : field.name,
      );
  }
}
