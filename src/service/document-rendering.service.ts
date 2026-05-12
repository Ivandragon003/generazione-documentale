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
    const result = content.replace(
      /\{\{([^}]+)\}\}/g,
      (match, rawKey: string) => {
        const key = rawKey.split(":")[0].trim();
        const value = fieldValues[key];
        if (value === undefined || value === null || value === "") {
          unresolved.push(key);
          return strict ? "" : match;
        }
        return String(value);
      },
    );
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
      .map((field) =>
        field.label && field.label.trim().length > 0 ? field.label : field.name,
      );
  }
}
