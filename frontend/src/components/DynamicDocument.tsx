import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type React from "react";
import type {
  ApiTemplateField,
  FieldRow,
  FieldValue,
  FieldValueMap,
} from "../data/api";
import {
  emptyRow,
  labelFromName,
  type NormalizedField,
  PLACEHOLDER_REGEX,
  stringifyFieldValue,
} from "../utils/template";

type Props = {
  markdown: string;
  fields: NormalizedField[];
  values: FieldValueMap;
  errors?: Record<string, string>;
  readOnly?: boolean;
  onChange?: (name: string, value: FieldValue) => void;
};

function fieldOptions(field: ApiTemplateField) {
  if (field.options?.length) return field.options;
  if (!field.defaultValue) return [];
  return field.defaultValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((value) => ({ label: value, value }));
}

function updateRowValue(
  rows: FieldRow[],
  rowIndex: number,
  columnName: string,
  value: FieldValue,
): FieldRow[] {
  return rows.map((row, index) =>
    index === rowIndex ? { ...row, [columnName]: value } : row,
  );
}

function removeRow(rows: FieldRow[], rowIndex: number): FieldRow[] {
  return rows.filter((_, index) => index !== rowIndex);
}

function asRows(value: FieldValue | undefined): FieldRow[] {
  return Array.isArray(value) ? value : [];
}

function valueForInput(value: FieldValue | undefined): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "";
}

function resolveHtmlInputType(type: ApiTemplateField["type"]): string {
  switch (type) {
    case "number":
    case "integer":
    case "currency":
    case "percentage":
      return "number";
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

function parseNumberOrEmpty(raw: string): number | "" {
  if (raw.trim() === "") return "";
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : "";
}

function isChecked(value: FieldValue | undefined): boolean {
  return value === true || value === "true";
}

function formatDateForPreview(value: FieldValue | undefined): string {
  if (typeof value !== "string") return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function renderReadOnlyField(field: ApiTemplateField, value: FieldValue) {
  if (Array.isArray(value)) {
    return (
      <EditableTable
        field={field}
        value={value}
        readOnly
        onChange={() => undefined}
      />
    );
  }
  return (
    <Box component="span" className="inline-value">
      {(field.type === "date"
        ? formatDateForPreview(value)
        : stringifyFieldValue(value)) || `{{${field.name}}}`}
    </Box>
  );
}

function EditableScalarField({
  field,
  value,
  error,
  readOnly = false,
  onChange,
}: {
  field: ApiTemplateField;
  value: FieldValue | undefined;
  error?: string;
  readOnly?: boolean;
  onChange: (value: FieldValue) => void;
}) {
  const type = field.type ?? "text";
  if (readOnly) return renderReadOnlyField(field, value ?? null);

  if (type === "boolean" || type === "checkbox") {
    return (
      <FormControl error={Boolean(error)} component="span">
        <FormControlLabel
          className="inline-checkbox"
          control={
            <Checkbox
              size="small"
              checked={isChecked(value)}
              onChange={(event) => onChange(event.target.checked)}
            />
          }
          label={field.label ?? labelFromName(field.name)}
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (type === "select") {
    return (
      <FormControl size="small" error={Boolean(error)} className="inline-field">
        <Select
          value={valueForInput(value)}
          displayEmpty
          onChange={(event) => onChange(event.target.value)}
        >
          <MenuItem value="">
            <em>{field.placeholder ?? field.label ?? field.name}</em>
          </MenuItem>
          {fieldOptions(field).map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  const multiline = type === "textarea";
  const htmlType = resolveHtmlInputType(type);
  const dateField = htmlType === "date";

  return (
    <TextField
      className={
        multiline ? "inline-field inline-field-textarea" : "inline-field"
      }
      size="small"
      type={htmlType}
      multiline={multiline}
      minRows={multiline ? 3 : undefined}
      label={dateField ? undefined : (field.label ?? labelFromName(field.name))}
      placeholder={dateField ? undefined : field.placeholder}
      InputLabelProps={dateField ? { shrink: true } : undefined}
      value={valueForInput(value)}
      error={Boolean(error)}
      helperText={error}
      onChange={(event) =>
        onChange(
          type === "number" ||
            type === "integer" ||
            type === "currency" ||
            type === "percentage"
            ? parseNumberOrEmpty(event.target.value)
            : event.target.value,
        )
      }
      inputProps={
        type === "number" ||
        type === "integer" ||
        type === "currency" ||
        type === "percentage"
          ? { inputMode: "decimal", step: "any" }
          : {}
      }
    />
  );
}

function EditableTable({
  field,
  value,
  readOnly = false,
  onChange,
}: {
  field: ApiTemplateField;
  value: FieldRow[];
  readOnly?: boolean;
  onChange: (value: FieldRow[]) => void;
}) {
  const columns =
    field.columns && field.columns.length > 0
      ? field.columns
      : [{ name: "valore", label: "Valore", type: "text" as const }];

  return (
    <Box className="dynamic-table">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.name}>
                {column.label ?? labelFromName(column.name)}
              </TableCell>
            ))}
            {!readOnly && <TableCell width={48} />}
          </TableRow>
        </TableHead>
        <TableBody>
          {value.map((row, rowIndex) => (
            <TableRow key={`${field.name}-${JSON.stringify(row)}`}>
              {columns.map((column) => {
                const columnType = column.type ?? "text";
                const nested =
                  columnType === "table" ||
                  columnType === "subtable" ||
                  columnType === "list" ||
                  columnType === "repeater";
                return (
                  <TableCell key={column.name}>
                    {nested ? (
                      <EditableTable
                        field={column}
                        value={asRows(row[column.name])}
                        readOnly={readOnly}
                        onChange={(nestedRows) =>
                          onChange(
                            updateRowValue(
                              value,
                              rowIndex,
                              column.name,
                              nestedRows,
                            ),
                          )
                        }
                      />
                    ) : (
                      <EditableScalarField
                        field={column}
                        value={row[column.name]}
                        readOnly={readOnly}
                        onChange={(next) =>
                          onChange(
                            updateRowValue(value, rowIndex, column.name, next),
                          )
                        }
                      />
                    )}
                  </TableCell>
                );
              })}
              {!readOnly && (
                <TableCell>
                  <IconButton
                    size="small"
                    aria-label="Rimuovi riga"
                    onClick={() => onChange(removeRow(value, rowIndex))}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!readOnly && (
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => onChange([...value, emptyRow(columns)])}
        >
          Aggiungi riga
        </Button>
      )}
    </Box>
  );
}

function InlineContent({
  text,
  fields,
  values,
  errors,
  readOnly,
  onChange,
}: Props & { text: string }) {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  function renderInlineMarkdown(rawText: string, keyPrefix: string) {
    const nodes: React.ReactNode[] = [];
    const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let cursor = 0;
    let tokenIndex = 0;
    for (const token of rawText.matchAll(inlineRegex)) {
      const matched = token[0];
      const index = token.index ?? 0;
      if (index > cursor) {
        nodes.push(rawText.slice(cursor, index));
      }
      if (matched.startsWith("**") && matched.endsWith("**")) {
        nodes.push(
          <strong key={`${keyPrefix}-b-${tokenIndex}`}>
            {matched.slice(2, -2)}
          </strong>,
        );
      } else if (matched.startsWith("*") && matched.endsWith("*")) {
        nodes.push(
          <em key={`${keyPrefix}-i-${tokenIndex}`}>{matched.slice(1, -1)}</em>,
        );
      } else {
        nodes.push(matched);
      }
      cursor = index + matched.length;
      tokenIndex += 1;
    }
    if (cursor < rawText.length) {
      nodes.push(rawText.slice(cursor));
    }
    return nodes;
  }

  for (const match of text.matchAll(PLACEHOLDER_REGEX)) {
    const [raw, inlineType, name] = match;
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(
        ...renderInlineMarkdown(
          text.slice(lastIndex, index),
          `${name}-${index}-${lastIndex}`,
        ),
      );
    }

    const field = byName.get(name) ?? {
      name,
      label: labelFromName(name),
      type: (inlineType ?? "string") as ApiTemplateField["type"],
      required: true,
      defaultValue: "",
    };
    const complex =
      field.type === "table" ||
      field.type === "subtable" ||
      field.type === "list" ||
      field.type === "repeater";

    parts.push(
      complex ? (
        <EditableTable
          key={`${name}-${index}`}
          field={field}
          value={asRows(values[name])}
          readOnly={readOnly}
          onChange={(next) => onChange?.(name, next)}
        />
      ) : (
        <EditableScalarField
          key={`${name}-${index}`}
          field={field}
          value={values[name]}
          error={errors?.[name]}
          readOnly={readOnly}
          onChange={(next) => onChange?.(name, next)}
        />
      ),
    );
    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(
      ...renderInlineMarkdown(text.slice(lastIndex), `tail-${lastIndex}`),
    );
  }
  return <>{parts}</>;
}

function renderLine(line: string, index: number, props: Props) {
  const quote = /^\s*>\s+(.+)$/.exec(line);
  if (quote) {
    return (
      <Box key={index} className="doc-quote">
        <InlineContent {...props} text={quote[1]} />
      </Box>
    );
  }

  const heading = /^(#{1,6})\s+(.+)$/.exec(line);
  if (heading) {
    const level = Math.min(heading[1].length, 6);
    const variant = level <= 1 ? "h4" : level === 2 ? "h5" : "h6";
    return (
      <Typography
        key={index}
        variant={variant}
        className={`doc-heading h${level}`}
      >
        <InlineContent {...props} text={heading[2]} />
      </Typography>
    );
  }

  if (/^\s*---+\s*$/.test(line))
    return <Box key={index} className="doc-rule" />;

  const bullet = /^\s*[-*]\s+(.+)$/.exec(line);
  if (bullet) {
    return (
      <li key={index}>
        <InlineContent {...props} text={bullet[1]} />
      </li>
    );
  }

  if (line.trim().length === 0)
    return <Box key={index} className="doc-space" />;

  return (
    <Typography key={index} className="doc-paragraph">
      <InlineContent {...props} text={line} />
    </Typography>
  );
}

function tryRenderMarkdownTable(lines: string[], start: number, props: Props) {
  if (
    !lines[start]?.includes("|") ||
    !lines[start + 1]?.match(/^\s*\|?\s*:?-{3,}/)
  ) {
    return null;
  }
  const tableLines: string[] = [];
  let cursor = start;
  while (cursor < lines.length && lines[cursor].includes("|")) {
    tableLines.push(lines[cursor]);
    cursor += 1;
  }
  const rows = tableLines
    .filter((_, index) => index !== 1)
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );
  const [header = [], ...body] = rows;

  return {
    next: cursor,
    node: (
      <Table key={start} size="small" className="markdown-table">
        <TableHead>
          <TableRow>
            {header.map((cell) => (
              <TableCell key={cell}>
                <InlineContent {...props} text={cell} />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {body.map((row) => (
            <TableRow key={`${start}-${row.join("|")}`}>
              {row.map((cell) => (
                <TableCell key={`${start}-${row.join("|")}-${cell}`}>
                  <InlineContent {...props} text={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    ),
  };
}

export function DynamicDocument(props: Props) {
  const lines = props.markdown.split(/\r?\n/);
  const nodes: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const table = tryRenderMarkdownTable(lines, index, props);
    if (table) {
      nodes.push(table.node);
      index = table.next;
      continue;
    }
    nodes.push(renderLine(lines[index], index, props));
    index += 1;
  }

  return (
    <Box
      className={
        props.readOnly ? "dynamic-document readonly" : "dynamic-document"
      }
    >
      {nodes}
    </Box>
  );
}
