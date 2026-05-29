type Severity = "error" | "warning";

export type LivePlaceholderIssue = {
  severity: Severity;
  line: number;
  column: number;
  snippet: string;
  message: string;
  suggestion?: string;
  startIndex?: number;
  endIndex?: number;
};

type Position = { index: number; line: number; column: number };

const SNAKE_CASE_REGEX = /^[a-z_][a-z0-9_]*$/;
const BASIC_TYPED_REGEX = /^\{\{([a-z]+):([a-z_][a-z0-9_]*)\}\}$/;
const EXTENDED_TYPED_REGEX =
  /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+):(true|false)(?::([^:{}\n]+)(?::([^{}]*))?)?\}\}$/;
const LENGTH_ONLY_TYPED_REGEX = /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+)\}\}$/;
const LENGTH_REQUIRED_TYPED_REGEX =
  /^\{\{([a-z]+):([a-z_][a-z0-9_]*):(\d+):(true|false)\}\}$/;
const LEGACY_REGEX = /^\{\{([a-z_][a-z0-9_]*)\}\}$/;

const ALLOWED_TYPES = [
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
] as const;
const ALLOWED_TYPE_SET: ReadonlySet<string> = new Set(ALLOWED_TYPES);

function toLineColumn(
  input: string,
  index: number,
): { line: number; column: number } {
  const safe = Math.max(0, Math.min(index, input.length));
  const slice = input.slice(0, safe);
  const lines = slice.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function compactSnippet(value: string): string {
  return value.replace(/\s+/g, " ").slice(0, 160);
}

function damerauLevenshtein(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const d = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) d[i][0] = i;
  for (let j = 0; j < cols; j += 1) d[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        left[i - 1] === right[j - 2] &&
        left[i - 2] === right[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[left.length][right.length];
}

function closestTypeSuggestion(rawType: string): string | undefined {
  const normalized = rawType.trim().toLowerCase();
  if (!normalized) return undefined;
  const ranked = ALLOWED_TYPES.map((type) => ({
    type,
    distance: damerauLevenshtein(normalized, type),
  })).sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.distance > 2) return undefined;
  if (second && second.distance === best.distance) return undefined;
  return best.type;
}

function invalidTypeIssue(
  type: string,
  line: number,
  column: number,
  token: string,
  startIndex: number,
  endIndex: number,
): LivePlaceholderIssue {
  const closest = closestTypeSuggestion(type);
  return {
    severity: "error",
    line,
    column,
    snippet: compactSnippet(token),
    message: closest
      ? `Invalid placeholder type: "${type}". Did you mean "${closest}"?`
      : `Invalid placeholder type: "${type}".`,
    startIndex,
    endIndex,
  };
}

function validateClosedToken(
  token: string,
  line: number,
  column: number,
  startIndex: number,
  endIndex: number,
): { issue?: LivePlaceholderIssue; fieldName?: string } {
  if (EXTENDED_TYPED_REGEX.test(token)) {
    const match = EXTENDED_TYPED_REGEX.exec(token);
    const type = match?.[1] ?? "";
    if (!ALLOWED_TYPE_SET.has(type)) {
      return {
        issue: invalidTypeIssue(
          type,
          line,
          column,
          token,
          startIndex,
          endIndex,
        ),
      };
    }
    if (type === "list") {
      const rawListPayload = match?.[5]?.trim() ?? "";
      const legacyRawListValues = match?.[6];
      const csvParts =
        legacyRawListValues !== undefined
          ? [
              rawListPayload,
              ...legacyRawListValues.split(",").map((item) => item.trim()),
            ]
          : rawListPayload.split(",").map((item) => item.trim());
      const listLabel = csvParts[0]?.trim() ?? "";
      const listValues = csvParts.slice(1).filter(Boolean);
      const normalizedListName = listLabel
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (!listLabel) {
        return {
          issue: {
            severity: "error",
            line,
            column,
            snippet: compactSnippet(token),
            message: "Invalid list placeholder: missing label.",
            suggestion:
              "Example: {{list:priorita:100:true:Priorità:bassa,media,alta}}",
            startIndex,
            endIndex,
          },
        };
      }
      if (!SNAKE_CASE_REGEX.test(normalizedListName)) {
        return {
          issue: {
            severity: "error",
            line,
            column,
            snippet: compactSnippet(token),
            message:
              "Invalid list placeholder: label must produce a valid technical name.",
            suggestion: "Example: Priorità",
            startIndex,
            endIndex,
          },
        };
      }
      if (listValues.length === 0) {
        return {
          issue: {
            severity: "error",
            line,
            column,
            snippet: compactSnippet(token),
            message: "Invalid list placeholder: missing options.",
            suggestion:
              "Example: {{list:priorita:100:true:Priorità:bassa,media,alta}}",
            startIndex,
            endIndex,
          },
        };
      }
    }
    if (type !== "list" && (match?.[5] || match?.[6] !== undefined)) {
      return {
        issue: {
          severity: "error",
          line,
          column,
          snippet: compactSnippet(token),
          message:
            "Invalid placeholder format: label and list options are only allowed for list placeholders.",
          startIndex,
          endIndex,
        },
      };
    }
    return { fieldName: match?.[2] };
  }

  if (BASIC_TYPED_REGEX.test(token)) {
    const match = BASIC_TYPED_REGEX.exec(token);
    const type = match?.[1] ?? "";
    if (!ALLOWED_TYPE_SET.has(type)) {
      return {
        issue: invalidTypeIssue(
          type,
          line,
          column,
          token,
          startIndex,
          endIndex,
        ),
      };
    }
    return { fieldName: match?.[2] };
  }

  if (
    LENGTH_ONLY_TYPED_REGEX.test(token) ||
    LENGTH_REQUIRED_TYPED_REGEX.test(token)
  ) {
    const match =
      LENGTH_ONLY_TYPED_REGEX.exec(token) ??
      LENGTH_REQUIRED_TYPED_REGEX.exec(token);
    const type = match?.[1] ?? "";
    if (!ALLOWED_TYPE_SET.has(type)) {
      return {
        issue: invalidTypeIssue(
          type,
          line,
          column,
          token,
          startIndex,
          endIndex,
        ),
      };
    }
    return { fieldName: match?.[2] };
  }

  if (LEGACY_REGEX.test(token)) {
    const match = LEGACY_REGEX.exec(token);
    return { fieldName: match?.[1] };
  }

  const rawContent = token.slice(2, -2);
  const parts = rawContent.split(":");
  if (parts.length >= 3) {
    const [rawType, , rawLength, rawRequired] = parts;
    if (
      rawType &&
      /^[a-z]+$/i.test(rawType) &&
      !ALLOWED_TYPE_SET.has(rawType.toLowerCase())
    ) {
      return {
        issue: invalidTypeIssue(
          rawType,
          line,
          column,
          token,
          startIndex,
          endIndex,
        ),
      };
    }
    if (rawLength && !/^\d+$/.test(rawLength.trim())) {
      return {
        issue: {
          severity: "error",
          line,
          column,
          snippet: compactSnippet(token),
          message: `Invalid length: "${rawLength}". It must be a number.`,
          startIndex,
          endIndex,
        },
      };
    }
    if (rawRequired !== undefined) {
      const normalizedRequired = rawRequired.trim().toLowerCase();
      if (normalizedRequired !== "true" && normalizedRequired !== "false") {
        return {
          issue: {
            severity: "error",
            line,
            column,
            snippet: compactSnippet(token),
            message: `Invalid required value: "${rawRequired}". Use true or false.`,
            startIndex,
            endIndex,
          },
        };
      }
    }
  }

  return {
    issue: {
      severity: "error",
      line,
      column,
      snippet: compactSnippet(token),
      message:
        "Invalid placeholder format. Expected format: {{type:field_name:length:required}}",
      suggestion: "Length and required are optional: {{string:field_name}}",
      startIndex,
      endIndex,
    },
  };
}

export function analyzeLivePlaceholderIssues(
  markdown: string,
): LivePlaceholderIssue[] {
  const issues: LivePlaceholderIssue[] = [];
  const openings: Position[] = [];

  for (let i = 0; i < markdown.length - 1; i += 1) {
    const pair = markdown.slice(i, i + 2);
    if (pair === "{{") {
      const lc = toLineColumn(markdown, i);
      openings.push({ index: i, line: lc.line, column: lc.column });
      i += 1;
      continue;
    }
    if (pair === "}}") {
      const opening = openings.pop();
      if (!opening) {
        const lc = toLineColumn(markdown, i);
        issues.push({
          severity: "error",
          line: lc.line,
          column: lc.column,
          snippet: "}}",
          message: "Placeholder closing token without opening token.",
          suggestion: "Add {{ before }} or remove the extra closing token.",
          startIndex: i,
          endIndex: i + 2,
        });
        i += 1;
        continue;
      }
      const token = markdown.slice(opening.index, i + 2);
      const validation = validateClosedToken(
        token,
        opening.line,
        opening.column,
        opening.index,
        i + 2,
      );
      if (validation.issue) {
        issues.push(validation.issue);
      }
      i += 1;
    }
  }

  for (const opening of openings) {
    const lineEnd = markdown.indexOf("\n", opening.index);
    const endIndex = lineEnd === -1 ? markdown.length : lineEnd;
    issues.push({
      severity: "warning",
      line: opening.line,
      column: opening.column,
      snippet: compactSnippet(markdown.slice(opening.index, endIndex)),
      message: "Unclosed placeholder. Missing }}",
      suggestion: "Complete the placeholder by adding }}.",
      startIndex: opening.index,
      endIndex,
    });
  }

  return issues.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    if (a.severity === b.severity) return 0;
    return a.severity === "error" ? -1 : 1;
  });
}
