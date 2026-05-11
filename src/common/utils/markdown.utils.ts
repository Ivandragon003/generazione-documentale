import type {
  FieldDefinition,
  FieldType,
} from "../types/field-definition.type";

export interface MarkdownValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fields: FieldDefinition[];
}

// La regex e definita DENTRO la funzione per evitare che il lastIndex condiviso
// del flag 'g' causi bug se qualcuno usasse .exec() o .test() direttamente
export const extractFieldNames = (content: string): string[] => {
  const placeholderRegex = /\{\{(\w+)\}\}/g;
  const fields = new Set<string>();
  for (const match of content.matchAll(placeholderRegex)) {
    const fieldName = match[1];
    if (fieldName) {
      fields.add(fieldName);
    }
  }
  return [...fields];
};

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
}

export const normalizeFieldDefinitions = (
  content: string,
  inputFields: PartialFieldDefinition[] = [],
): FieldDefinition[] => {
  const placeholders = extractFieldNames(content);
  const providedByName = new Map(
    inputFields.map((field) => [field.name, field]),
  );

  return placeholders.map((placeholder) => {
    const provided = providedByName.get(placeholder);

    return {
      name: placeholder,
      label: provided?.label ?? labelFromName(placeholder),
      type: provided?.type ?? "text",
      required: provided?.required ?? true,
      defaultValue: provided?.defaultValue ?? "",
    };
  });
};

export const validateMarkdownContent = (
  content: string,
  maxBytes: number,
): MarkdownValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Valida che content sia definito e sia una stringa
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return {
      valid: false,
      errors: ["Il contenuto del template non puo essere vuoto"],
      warnings,
      fields: [],
    };
  }

  if (Buffer.byteLength(content, "utf8") > maxBytes) {
    errors.push(`Template troppo grande. Limite: ${maxBytes} byte`);
  }

  const openCount = (content.match(/\{\{/g) ?? []).length;
  const closeCount = (content.match(/\}\}/g) ?? []).length;
  if (openCount !== closeCount) {
    errors.push(
      "Ci sono parentesi placeholder non bilanciate: controlla {{ e }}",
    );
  }

  // Limite {1,100} sul contenuto interno: impedisce backtracking super-lineare
  // (ReDoS) su input con molti {{ non chiusi. I nomi campo realistici non
  // superano mai 100 caratteri, quindi nessun falso negativo.
  const invalidPlaceholders = (
    content.match(/\{\{[^}\n]{1,100}\}\}/g) ?? []
  ).filter((placeholder) => !/^\{\{\w+\}\}$/.test(placeholder));
  if (invalidPlaceholders.length > 0) {
    errors.push(
      `Placeholder non validi: ${[...new Set(invalidPlaceholders)].join(", ")}`,
    );
  }

  const blockedPatterns: Array<{ pattern: RegExp; label: string }> = [
    {
      // input/include/write18: richiedono separatore dopo il nome del comando
      // openout/read: possono essere seguiti da cifre (es. \openout5, \read0),
      // quindi accettiamo qualsiasi carattere non-lettera dopo il nome
      pattern:
        /\\(?:input|include|write18)(?=\s|[^a-zA-Z]|$)|\\(?:openout|read)(?=[^a-zA-Z]|$)/i,
      label: "comandi LaTeX di input/output",
    },
    { pattern: /<script\b/i, label: "tag script HTML" },
    { pattern: /<iframe\b/i, label: "tag iframe HTML" },
  ];
  const blockedMatches = blockedPatterns
    .filter((candidate) => candidate.pattern.test(content))
    .map((candidate) => candidate.label);

  if (blockedMatches.length > 0) {
    errors.push(
      `Contenuto non consentito per sicurezza: ${blockedMatches.join(", ")}`,
    );
  }

  const fields = normalizeFieldDefinitions(content);
  if (fields.length === 0) {
    warnings.push(
      "Nessun campo dinamico trovato. Usa placeholder come {{titolo}}",
    );
  }

  if (!/^#\s+.+/m.test(content)) {
    warnings.push(
      "Nessun titolo Markdown H1 trovato. Aggiungi una riga tipo # {{titolo}}",
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fields,
  };
};
