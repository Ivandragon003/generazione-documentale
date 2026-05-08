import { Injectable } from "@nestjs/common";
import type { FieldDefinition } from "../common/types/field-definition.type";

@Injectable()
export class DocumentRenderingService {
  renderTemplate(
    content: string,
    fieldValues: Record<string, string | number | boolean | null>,
    strict: boolean,
  ): { result: string; unresolved: string[] } {
    const unresolved: string[] = [];
    const result = content.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const normalizedKey = key.trim();
      const value = fieldValues[normalizedKey];
      if (value === undefined || value === null || value === "") {
        unresolved.push(normalizedKey);
        return strict ? "" : match;
      }
      return String(value);
    });
    return { result, unresolved };
  }

  getMissingRequiredFields(
    fields: FieldDefinition[],
    fieldValues: Record<string, string | number | boolean | null>,
  ): string[] {
    return fields
      .filter(
        (field) =>
          field.required !== false &&
          (fieldValues[field.name] === undefined ||
            fieldValues[field.name] === null ||
            fieldValues[field.name] === ""),
      )
      .map((field) => field.label ?? field.name);
  }
}
