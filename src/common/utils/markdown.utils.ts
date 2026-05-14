import type {
  FieldColumnDefinition,
  FieldDefinition,
  FieldOption,
  FieldType,
} from "../types/field-definition.type";

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
}

const TEMPLATE_PLACEHOLDER_TOKEN_REGEX = /\{\{[^{}\n]*\}\}/g;
const STRICT_TYPED_PLACEHOLDER_REGEX = /^\{\{([a-z]+):([a-z_][a-z0-9_]*)\}\}$/;
const GENERIC_TYPED_PLACEHOLDER_REGEX = /^\{\{([^:\s{}]+):([^{}\s]*)\}\}$/;
const LEGACY_UNTYPED_PLACEHOLDER_REGEX = /^\{\{([a-z_][a-z0-9_]*)\}\}$/;

export const allowedTemplateFieldTypes = [
  "string",
  "text",
  "number",
  "integer",
  "date",
  "currency",
  "percentage",
  "boolean",
  "email",
  "phone",
] as const satisfies readonly FieldType[];

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

export const isFieldType = (value: string | undefined): value is FieldType =>
  Boolean(value && allowedFieldTypeSet.has(value));

const labelFromName = (name: string): string => {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export interface PartialFieldDefinition {
  name: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: FieldOption[];
  columns?: FieldColumnDefinition[];
}

function validatePlaceholderToken(token: string): {
  valid: boolean;
  type?: FieldType;
  name?: string;
  legacyUntyped?: boolean;
  error?: string;
} {
  if (/\s/.test(token)) {
    return {
      valid: false,
      error: `Invalid placeholder ${token}: spaces are not allowed`,
    };
  }

  const strictMatch = token.match(STRICT_TYPED_PLACEHOLDER_REGEX);
  if (strictMatch) {
    const type = strictMatch[1];
    const name = strictMatch[2];
    if (!allowedTemplateTypeSet.has(type)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: unsupported type "${type}"`,
      };
    }
    return { valid: true, type: type as FieldType, name };
  }

  const legacyMatch = token.match(LEGACY_UNTYPED_PLACEHOLDER_REGEX);
  if (legacyMatch) {
    const name = legacyMatch[1];
    return {
      valid: true,
      type: "string",
      name,
      legacyUntyped: true,
    };
  }

  const genericMatch = token.match(GENERIC_TYPED_PLACEHOLDER_REGEX);
  if (genericMatch) {
    const rawType = genericMatch[1] ?? "";
    const rawName = genericMatch[2] ?? "";
    if (!/^[a-z]+$/.test(rawType)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: type must be lowercase`,
      };
    }
    if (!allowedTemplateTypeSet.has(rawType)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: unsupported type "${rawType}"`,
      };
    }
    if (!/^[a-z_][a-z0-9_]*$/.test(rawName)) {
      return {
        valid: false,
        error: `Invalid placeholder ${token}: field_name must be snake_case and cannot start with a number`,
      };
    }
    return { valid: true, type: rawType as FieldType, name: rawName };
  }

  return {
    valid: false,
    error: `Invalid placeholder ${token}: expected format {{type:field_name}}`,
  };
}

export function parseTemplatePlaceholders(content: string): {
  fields: ParsedTemplatePlaceholder[];
  errors: string[];
  legacyUntypedNames: string[];
} {
  const errors: string[] = [];
  const fields: ParsedTemplatePlaceholder[] = [];
  const legacyUntypedNames: string[] = [];
  const byName = new Map<string, FieldType>();
  const tokens = content.match(TEMPLATE_PLACEHOLDER_TOKEN_REGEX) ?? [];

  for (const token of tokens) {
    const validation = validatePlaceholderToken(token);
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

export const extractFieldNames = (content: string): string[] => {
  const { fields } = parseTemplatePlaceholders(content);
  return fields.map((field) => field.name);
};

export const extractFieldsWithTypes = (
  content: string,
): Map<string, FieldType> => {
  const { fields } = parseTemplatePlaceholders(content);
  return new Map(fields.map((field) => [field.name, field.type]));
};

export const normalizeFieldDefinitions = (
  content: string,
  inputFields: PartialFieldDefinition[] = [],
): FieldDefinition[] => {
  const placeholders = parseTemplatePlaceholders(content).fields;
  const providedByName = new Map(
    inputFields.map((field) => [field.name, field]),
  );

  return placeholders.map((placeholder) => {
    const provided = providedByName.get(placeholder.name);

    return {
      name: placeholder.name,
      label: provided?.label ?? labelFromName(placeholder.name),
      type: placeholder.type,
      required: provided?.required ?? true,
      defaultValue: provided?.defaultValue ?? "",
      source: "template",
      placeholder: provided?.placeholder,
      options: provided?.options,
      columns: provided?.columns,
    };
  });
};

export const validateMarkdownContent = (
  content: string,
  maxBytes: number,
): MarkdownValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!content || typeof content !== "string" || content.trim().length === 0) {
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

  const parsed = parseTemplatePlaceholders(content);
  errors.push(...parsed.errors);

  const blockedPatterns: Array<{ pattern: RegExp; label: string }> = [
    {
      pattern:
        /\\(?:input|include|write18)(?=\s|[^a-zA-Z]|$)|\\(?:openout|read)(?=[^a-zA-Z]|$)/i,
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

  const fields = normalizeFieldDefinitions(content);
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
};
