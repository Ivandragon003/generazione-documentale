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

// Keep regex inside the function to avoid shared lastIndex state
// when using the global flag with exec/test across calls.
export const extractFieldNames = (content: string): string[] => {
  const placeholderRegex = /\{\{(\w+)(?::\w+)?\}\}/g;
  const fields = new Set<string>();
  for (const match of content.matchAll(placeholderRegex)) {
    const fieldName = match[1];
    if (fieldName) {
      fields.add(fieldName);
    }
  }
  return [...fields];
};

export const extractFieldsWithTypes = (
  content: string,
): Map<string, FieldType> => {
  const placeholderRegex = /\{\{(\w+)(?::(\w+))?\}\}/g;
  const fields = new Map<string, FieldType>();
  for (const match of content.matchAll(placeholderRegex)) {
    const fieldName = match[1];
    const fieldType = match[2] as FieldType;
    if (fieldName) {
      // If multiple placeholders share the same name, the latest type wins
      // or an explicitly declared type when present.
      if (fieldType || !fields.has(fieldName)) {
        fields.set(fieldName, fieldType || "text");
      }
    }
  }
  return fields;
};

export const allowedFieldTypes: FieldType[] = [
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
];

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

export const normalizeFieldDefinitions = (
  content: string,
  inputFields: PartialFieldDefinition[] = [],
): FieldDefinition[] => {
  const placeholders = extractFieldNames(content);
  const inlineTypes = extractFieldsWithTypes(content);
  const providedByName = new Map(
    inputFields.map((field) => [field.name, field]),
  );

  return placeholders.map((placeholder) => {
    const provided = providedByName.get(placeholder);
    const inlineType = inlineTypes.get(placeholder);

    return {
      name: placeholder,
      label: provided?.label ?? labelFromName(placeholder),
      type: provided?.type ?? inlineType ?? "text",
      required: provided?.required ?? true,
      defaultValue: provided?.defaultValue ?? "",
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

  // Validate that content is present and is a string
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

  // Internal {1,100} limit prevents super-linear backtracking
  // (ReDoS) for inputs with many unclosed {{ sequences. Real-world field names
  // do not exceed 100 chars, avoiding false negatives.
  const invalidPlaceholders = (
    content.match(/\{\{[^}\n]{1,100}\}\}/g) ?? []
  ).filter((placeholder) => !/^\{\{\w+(?::\w+)?\}\}$/.test(placeholder));
  if (invalidPlaceholders.length > 0) {
    errors.push(
      `Invalid placeholders: ${[...new Set(invalidPlaceholders)].join(", ")}`,
    );
  }

  const invalidTypes = [...extractFieldsWithTypes(content).entries()]
    .filter(([, type]) => !isFieldType(type))
    .map(([name, type]) => `${name}:${type}`);
  if (invalidTypes.length > 0) {
    errors.push(`Invalid field types: ${invalidTypes.join(", ")}`);
  }

  const blockedPatterns: Array<{ pattern: RegExp; label: string }> = [
    {
      // input/include/write18 require a separator after the command name
      // openout/read may be followed by digits (e.g. \openout5, \read0),
      // so any non-letter character is accepted after the name
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
  if (fields.length === 0) {
    warnings.push(
      "No dynamic fields found. Use placeholders such as {{title}}",
    );
  }

  if (!/^#\s+.+/m.test(content)) {
    warnings.push("No Markdown H1 title found. Add a line like # {{title}}");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fields,
  };
};
