import AddIcon from "@mui/icons-material/Add";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
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
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";
import type React from "react";
import { useEffect, useState } from "react";
import type {
  ApiTemplateField,
  FieldRow,
  FieldValue,
  FieldValueMap,
} from "../data/api";
import { parseMarkdownTable } from "../utils/markdownPreview";
import {
  emptyRow,
  fieldTypeHelperText,
  formatFieldValueForPreview,
  inputPlaceholderForField,
  labelFromName,
  type NormalizedField,
  PLACEHOLDER_REGEX,
  parsePlaceholderToken,
} from "../utils/template";
import {
  asRows,
  fieldOptions,
  isChecked,
  isNumericFieldType,
  isStrictNumericInput,
  parseNumberOrEmpty,
  removeRow,
  resolveHtmlInputType,
  updateRowValue,
  valueForInput,
} from "./dynamicDocument/fieldHelpers";

type Props = {
  markdown: string;
  fields: NormalizedField[];
  values: FieldValueMap;
  errors?: Record<string, string>;
  showTypeHints?: boolean;
  readOnly?: boolean;
  onChange?: (name: string, value: FieldValue) => void;
};

type RenderContext = Props & {
  fieldByName: Map<string, NormalizedField>;
};

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
  const displayValue = formatFieldValueForPreview(field.type, value) || "";
  const type = field.type ?? "text";
  if (type === "boolean" || type === "checkbox") {
    const boolValue = value === true;
    return (
      <Box
        component="span"
        className={`inline-boolean-badge ${boolValue ? "is-true" : "is-false"}`}
        title={boolValue ? "Yes" : "No"}
      >
        {boolValue ? (
          <CheckCircleIcon fontSize="inherit" />
        ) : (
          <CancelIcon fontSize="inherit" />
        )}
      </Box>
    );
  }
  if (!displayValue) {
    return <Box component="span" className="inline-value inline-value-empty" />;
  }
  return (
    <Box component="span" className="inline-value" title={displayValue}>
      {displayValue}
    </Box>
  );
}

function EditableScalarField({
  field,
  value,
  error,
  showTypeHints = false,
  readOnly = false,
  onChange,
}: {
  field: ApiTemplateField;
  value: FieldValue | undefined;
  error?: string;
  showTypeHints?: boolean;
  readOnly?: boolean;
  onChange: (value: FieldValue) => void;
}) {
  const type = field.type ?? "text";
  const fieldTypeClass = `inline-field-${type.replace(/[^a-z0-9_-]/gi, "-")}`;
  const numericField = isNumericFieldType(type);
  const [draftValue, setDraftValue] = useState(valueForInput(value));

  useEffect(() => {
    setDraftValue(valueForInput(value));
  }, [value]);

  if (readOnly) return renderReadOnlyField(field, value ?? null);

  const normalizeIntegerDraft = (raw: string): string => {
    let next = raw.replace(/[^\d-]/g, "");
    if (next.includes("-")) {
      const negative = next.startsWith("-");
      next = next.replace(/-/g, "");
      next = negative ? `-${next}` : next;
    }
    return next;
  };

  if (type === "boolean" || type === "checkbox") {
    const checkboxLabel = `${field.label ?? labelFromName(field.name)}${field.required === false ? "" : " *"}`;
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
          label={checkboxLabel}
        />
        {error && <FormHelperText>{error}</FormHelperText>}
      </FormControl>
    );
  }

  if (type === "select" || type === "list") {
    return (
      <FormControl
        size="small"
        error={Boolean(error)}
        className={`inline-field ${fieldTypeClass}`}
      >
        <Select
          value={valueForInput(value)}
          displayEmpty
          inputProps={{
            "aria-label": field.label ?? labelFromName(field.name),
          }}
          onChange={(event) => onChange(event.target.value)}
        >
          <MenuItem value="">
            <em>{inputPlaceholderForField(field)}</em>
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
  const requiredIndicator =
    !readOnly && field.required !== false ? (
      <Typography
        component="span"
        className="inline-required-indicator"
        aria-hidden
      >
        *
      </Typography>
    ) : null;

  if (dateField) {
    const dateValue = typeof value === "string" && value ? dayjs(value) : null;
    const dateTextFieldProps = {
      className: `inline-field inline-date-field ${fieldTypeClass}`,
      size: "small" as const,
      error: Boolean(error),
      helperText: error ?? fieldTypeHelperText(field, showTypeHints),
      hiddenLabel: true,
      autoComplete: "new-password",
      name: `field_${field.name}`,
      inputProps: {
        "aria-label": field.label ?? labelFromName(field.name),
        autoComplete: "new-password",
        autoCorrect: "off",
        autoCapitalize: "none",
        spellCheck: "false",
      },
      placeholder: inputPlaceholderForField(field),
    };
    return (
      <Box className="inline-field-with-indicator">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            value={dateValue?.isValid() ? dateValue : null}
            format="DD/MM/YYYY"
            onChange={(next) => onChange(next ? next.format("YYYY-MM-DD") : "")}
            slotProps={{
              textField: dateTextFieldProps,
            }}
          />
        </LocalizationProvider>
        {requiredIndicator}
      </Box>
    );
  }

  return (
    <Box className="inline-field-with-indicator">
      <TextField
        className={
          multiline
            ? `inline-field inline-field-textarea ${fieldTypeClass}`
            : `inline-field ${fieldTypeClass}`
        }
        size="small"
        type={htmlType}
        multiline={multiline}
        minRows={multiline ? 3 : undefined}
        hiddenLabel
        autoComplete="new-password"
        name={`field_${field.name}`}
        placeholder={inputPlaceholderForField(field)}
        value={numericField ? draftValue : valueForInput(value)}
        error={Boolean(error)}
        helperText={error ?? fieldTypeHelperText(field, showTypeHints)}
        inputProps={{
          ...(type === "integer"
            ? { inputMode: "numeric", pattern: "^-?\\d*$" }
            : numericField
              ? { inputMode: "decimal", step: "any" }
              : {}),
          ...(field.maxLength && !numericField && !multiline
            ? { maxLength: field.maxLength }
            : {}),
          autoComplete: "new-password",
          autoCorrect: "off",
          autoCapitalize: "none",
          spellCheck: "false",
          "aria-label": field.label ?? labelFromName(field.name),
        }}
        onChange={(event) => {
          if ((event.nativeEvent as InputEvent | undefined)?.isComposing)
            return;
          const rawValue = event.target.value;
          if (numericField) {
            if (type === "integer") {
              const normalized = normalizeIntegerDraft(rawValue);
              setDraftValue(normalized);
              if (normalized === "" || normalized === "-") {
                onChange("");
                return;
              }
              if (!/^-?\d+$/.test(normalized)) return;
              onChange(Number.parseInt(normalized, 10));
              return;
            }
            if (!isStrictNumericInput(rawValue, type)) return;
            setDraftValue(rawValue);
            onChange(parseNumberOrEmpty(rawValue.replace(",", ".")));
            return;
          }
          onChange(rawValue);
        }}
        onBlur={() => {
          if (!numericField) return;
          if (type === "integer") {
            const normalized = normalizeIntegerDraft(draftValue);
            if (normalized === "" || normalized === "-") {
              onChange("");
              setDraftValue("");
              return;
            }
            if (!/^-?\d+$/.test(normalized)) {
              setDraftValue(valueForInput(value));
              return;
            }
            onChange(Number.parseInt(normalized, 10));
            setDraftValue(normalized);
            return;
          }
          if (draftValue.trim() === "") {
            onChange("");
            return;
          }
          if (!isStrictNumericInput(draftValue, type)) {
            setDraftValue(valueForInput(value));
          }
        }}
        onKeyDown={(event) => {
          if (type === "integer") {
            if (
              event.key === "e" ||
              event.key === "E" ||
              event.key === "+" ||
              event.key === "." ||
              event.key === ","
            ) {
              event.preventDefault();
            }
            return;
          }
          if (
            type === "number" ||
            type === "currency" ||
            type === "percentage"
          ) {
            if (event.key === "e" || event.key === "E" || event.key === "+") {
              event.preventDefault();
            }
          }
        }}
        onPaste={(event) => {
          if (type !== "integer") return;
          const pasted = event.clipboardData.getData("text");
          const normalized = normalizeIntegerDraft(pasted);
          if (normalized !== pasted.trim()) {
            event.preventDefault();
            setDraftValue(normalized);
            if (normalized === "" || normalized === "-") {
              onChange("");
              return;
            }
            if (/^-?\d+$/.test(normalized)) {
              onChange(Number.parseInt(normalized, 10));
            }
          }
        }}
      />
      {requiredIndicator}
    </Box>
  );
}

function EditableTable({
  field,
  value,
  showTypeHints = false,
  readOnly = false,
  onChange,
}: {
  field: ApiTemplateField;
  value: FieldRow[];
  showTypeHints?: boolean;
  readOnly?: boolean;
  onChange: (value: FieldRow[]) => void;
}) {
  const columns =
    field.columns && field.columns.length > 0
      ? field.columns
      : [{ name: "value", label: "Value", type: "text" as const }];

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
                  columnType === "repeater";
                return (
                  <TableCell key={column.name}>
                    {nested ? (
                      <EditableTable
                        field={column}
                        value={asRows(row[column.name])}
                        showTypeHints={showTypeHints}
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
                        showTypeHints={showTypeHints}
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
                    aria-label="Remove row"
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
          Add row
        </Button>
      )}
    </Box>
  );
}

function InlineContent({
  text,
  fieldByName,
  values,
  errors,
  showTypeHints,
  readOnly,
  onChange,
}: RenderContext & { text: string }) {
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
    const raw = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push(
        ...renderInlineMarkdown(
          text.slice(lastIndex, index),
          `plain-${index}-${lastIndex}`,
        ),
      );
    }

    const parsed = parsePlaceholderToken(raw);
    if (!parsed.field) {
      const invalidLabel =
        raw.startsWith("{{") && raw.endsWith("}}") ? raw.slice(2, -2) : raw;
      parts.push(
        <Box
          key={`invalid-${index}`}
          component="span"
          sx={{
            color: "#b91c1c",
            backgroundColor: "#fee2e2",
            borderBottom: "1px dashed #dc2626",
            px: 0.5,
            borderRadius: "4px",
            fontSize: "0.9em",
          }}
          title={
            parsed.invalid?.message ?? `Invalid placeholder: ${invalidLabel}`
          }
        >
          {`[Invalid placeholder: ${invalidLabel}]`}
        </Box>,
      );
      lastIndex = index + raw.length;
      continue;
    }

    const { name, type: parsedType } = parsed.field;
    const field = fieldByName.get(name) ?? {
      name,
      label: labelFromName(name),
      type: parsedType as ApiTemplateField["type"],
      required: true,
      defaultValue: "",
    };
    const complex =
      field.type === "table" ||
      field.type === "subtable" ||
      field.type === "repeater";

    parts.push(
      complex ? (
        <EditableTable
          key={`${name}-${index}`}
          field={field}
          value={asRows(values[name])}
          showTypeHints={showTypeHints}
          readOnly={readOnly}
          onChange={(next) => onChange?.(name, next)}
        />
      ) : (
        <EditableScalarField
          key={`${name}-${index}`}
          field={field}
          value={values[name]}
          error={errors?.[name]}
          showTypeHints={showTypeHints}
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

function renderLine(line: string, index: number, props: RenderContext) {
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

function tryRenderMarkdownTable(
  lines: string[],
  start: number,
  props: RenderContext,
) {
  const table = parseMarkdownTable(lines, start);
  if (!table) return null;

  return {
    next: table.next,
    node: (
      <Box key={start} className="markdown-table-wrap">
        <Table size="small" className="markdown-table">
          <TableHead>
            <TableRow>
              {table.header.map((cell) => (
                <TableCell key={cell} title={cell}>
                  <InlineContent {...props} text={cell} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {table.body.map((row) => (
              <TableRow key={`${start}-${row.join("|")}`}>
                {row.map((cell) => (
                  <TableCell
                    key={`${start}-${row.join("|")}-${cell}`}
                    title={cell}
                  >
                    <InlineContent {...props} text={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    ),
  };
}

export function DynamicDocument(props: Props) {
  const lines = props.markdown.split(/\r?\n/);
  const renderContext: RenderContext = {
    ...props,
    fieldByName: new Map(props.fields.map((field) => [field.name, field])),
  };
  const nodes: React.ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const table = tryRenderMarkdownTable(lines, index, renderContext);
    if (table) {
      nodes.push(table.node);
      index = table.next;
      continue;
    }
    nodes.push(renderLine(lines[index], index, renderContext));
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
