import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material/Select";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldType } from "../data/api";
import {
  type AiSemanticWarningDto,
  getTenantTemplateLists,
  type PdfJobDto,
} from "../data/api";
import type { LivePlaceholderIssue } from "../utils/livePlaceholderDiagnostics";
import { normalizeFieldName } from "../utils/template";

type Props = {
  readonly markdown: string;
  readonly tenantUuid?: string;
  readonly issues?: LivePlaceholderIssue[];
  readonly pdfJobs?: PdfJobDto[];
  readonly aiWarnings?: AiSemanticWarningDto[];
  readonly aiMeta?: {
    provider: string;
    model: string | null;
    latencyMs: number;
  } | null;
  readonly onRunAiReview?: () => void;
  readonly isAiReviewLoading?: boolean;
  readonly onApplySafeCorrection?: () => void;
  readonly onChange: (value: string) => void;
};

type ListValueInput = {
  id: string;
  value: string;
};

export function TemplateEditor({
  markdown,
  tenantUuid,
  issues = [],
  pdfJobs = [],
  aiWarnings = [],
  aiMeta = null,
  onRunAiReview,
  isAiReviewLoading = false,
  onApplySafeCorrection,
  onChange,
}: Props) {
  const [fieldNameInput, setFieldNameInput] = useState("");
  const [fieldTypeInput, setFieldTypeInput] = useState<FieldType>("text");
  const [fieldLengthInput, setFieldLengthInput] = useState("100");
  const [fieldRequiredInput, setFieldRequiredInput] = useState<
    "true" | "false"
  >("true");
  const [listSource, setListSource] = useState<"new" | "existing">("new");
  const [listNameInput, setListNameInput] = useState("");
  const [existingListName, setExistingListName] = useState("");
  const [listValuesInput, setListValuesInput] = useState<ListValueInput[]>([
    { id: crypto.randomUUID(), value: "" },
  ]);
  const [templateLists, setTemplateLists] = useState<
    Array<{ listName: string; values: string[] }>
  >([]);
  const [loadingTemplateLists, setLoadingTemplateLists] = useState(false);
  const [fieldNameError, setFieldNameError] = useState<string | null>(null);
  const [fieldLengthError, setFieldLengthError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [insertFieldAnchor, setInsertFieldAnchor] =
    useState<HTMLElement | null>(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const hasActiveSelection = isEditorFocused && selection.end > selection.start;
  const [showIssueDetails, setShowIssueDetails] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const insertFieldOpen = Boolean(insertFieldAnchor);
  const issueCount = issues.length;
  const hasSyntaxErrors = issues.some((issue) => issue.severity === "error");

  const fieldTypeOptions: FieldType[] = [
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
    "list",
  ];

  const typeLengthDefaults: Partial<Record<FieldType, string>> = {
    string: "100",
    text: "500",
    number: "20",
    integer: "10",
    date: "10",
    currency: "20",
    percentage: "5",
    boolean: "5",
    email: "120",
    phone: "15",
    list: "100",
  };
  const typeFixedLength: Partial<Record<FieldType, string>> = {
    boolean: "5",
    date: "10",
    phone: "15",
  };

  useEffect(() => {
    if (fieldTypeInput !== "list" || !tenantUuid) return;
    setLoadingTemplateLists(true);
    void getTenantTemplateLists(tenantUuid)
      .then((response) => {
        const mapped = response.map((item) => ({
          listName: item.list_name,
          values: item.values ?? [],
        }));
        setTemplateLists(mapped);
        if (mapped.length > 0 && !existingListName) {
          setExistingListName(mapped[0].listName);
        }
      })
      .finally(() => setLoadingTemplateLists(false));
  }, [existingListName, fieldTypeInput, tenantUuid]);

  const selectedExistingList = useMemo(
    () => templateLists.find((item) => item.listName === existingListName),
    [existingListName, templateLists],
  );

  function updateFieldType(type: FieldType): void {
    setFieldTypeInput(type);
    setFieldLengthInput(
      typeFixedLength[type] ?? typeLengthDefaults[type] ?? "100",
    );
    setListError(null);
  }

  function confirmCreateField(): void {
    const normalized = normalizeFieldName(fieldNameInput);
    if (!normalized) {
      setFieldNameError("Enter a valid variable name (e.g. customer_name).");
      return;
    }
    const effectiveLengthInput =
      typeFixedLength[fieldTypeInput] ?? fieldLengthInput;
    const parsedLength = Number.parseInt(effectiveLengthInput, 10);
    if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
      setFieldLengthError("Length must be a positive integer.");
      return;
    }

    const listLabel = listNameInput.trim();
    const createdValues = listValuesInput
      .map((item) => item.value.trim())
      .filter(Boolean)
      .filter((value, index, items) => items.indexOf(value) === index);
    if (fieldTypeInput === "list") {
      if (listSource === "existing" && !existingListName) {
        setListError("Select an existing list.");
        return;
      }
      if (listSource === "new" && !listLabel) {
        setListError("Enter a list label.");
        return;
      }
      const effectiveValues =
        listSource === "existing"
          ? (selectedExistingList?.values ?? [])
          : createdValues;
      if (effectiveValues.length === 0) {
        setListError("Insert at least one list value.");
        return;
      }
    }

    const placeholder =
      fieldTypeInput === "list"
        ? `{{list:${normalized}:${parsedLength}:${fieldRequiredInput}:${listSource === "existing" ? existingListName : listLabel}:${(listSource === "existing" ? (selectedExistingList?.values ?? []) : createdValues).join(",")}}}`
        : `{{${fieldTypeInput}:${normalized}:${parsedLength}:${fieldRequiredInput}}}`;
    const start = selection.start;
    const end = selection.end;
    const before = markdown.slice(0, start);
    const after = markdown.slice(end);
    onChange(`${before}${placeholder}${after}`);
    setFieldNameInput("");
    setFieldTypeInput("text");
    setFieldLengthInput("100");
    setFieldRequiredInput("true");
    setListSource("new");
    setListNameInput("");
    setExistingListName("");
    setListValuesInput([{ id: crypto.randomUUID(), value: "" }]);
    setFieldNameError(null);
    setFieldLengthError(null);
    setListError(null);
    setInsertFieldAnchor(null);
  }

  const effectiveLengthInput =
    typeFixedLength[fieldTypeInput] ?? fieldLengthInput;

  const issueRanges = useMemo(
    () =>
      issues
        .filter(
          (
            issue,
          ): issue is LivePlaceholderIssue & {
            startIndex: number;
            endIndex: number;
          } =>
            typeof issue.startIndex === "number" &&
            typeof issue.endIndex === "number" &&
            issue.endIndex > issue.startIndex,
        )
        .sort((a, b) => a.startIndex - b.startIndex),
    [issues],
  );
  const latestJob = pdfJobs[0];

  const highlightedOverlay = useMemo(() => {
    if (issueRanges.length === 0) return markdown;
    const chunks: React.ReactNode[] = [];
    let cursor = 0;
    issueRanges.forEach((issue) => {
      const start = Math.max(cursor, issue.startIndex);
      const end = Math.min(markdown.length, issue.endIndex);
      const issueKey = `${issue.line}:${issue.column}:${issue.startIndex}:${issue.endIndex}:${issue.message}`;
      if (start > cursor) {
        chunks.push(
          <span
            key={`plain-${cursor}-${start}`}
            style={{ pointerEvents: "none" }}
          >
            {markdown.slice(cursor, start)}
          </span>,
        );
      }
      if (end > start) {
        chunks.push(
          <Tooltip
            key={`overlay-${issueKey}`}
            title={
              issue.suggestion
                ? `${issue.message} ${issue.suggestion}`
                : issue.message
            }
            arrow
          >
            <mark
              style={{
                pointerEvents: "auto",
                backgroundColor:
                  issue.severity === "warning"
                    ? "rgba(245,158,11,0.28)"
                    : "rgba(239,68,68,0.26)",
                borderBottom:
                  issue.severity === "warning"
                    ? "1px dashed #d97706"
                    : "1px dashed #dc2626",
                color: "inherit",
                padding: 0,
              }}
            >
              {markdown.slice(start, end)}
            </mark>
          </Tooltip>,
        );
      }
      cursor = end;
    });
    if (cursor < markdown.length) {
      chunks.push(
        <span key={`plain-tail-${cursor}`} style={{ pointerEvents: "none" }}>
          {markdown.slice(cursor)}
        </span>,
      );
    }
    return chunks;
  }, [issueRanges, markdown]);

  const showOverlay = issueRanges.length > 0;

  function syncOverlayScroll() {
    if (!textareaRef.current || !overlayRef.current) return;
    overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  return (
    <Stack gap={2}>
      <Paper className="panel-shell">
        <Stack
          direction="row"
          gap={1}
          flexWrap="wrap"
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
            <Button
              size="small"
              variant="text"
              onClick={() => onChange(`**${markdown}**`)}
              title="Bold"
            >
              B
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => onChange(`*${markdown}*`)}
              title="Italic"
            >
              I
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={(event) => setInsertFieldAnchor(event.currentTarget)}
            >
              Insert field
            </Button>
            {onRunAiReview && (
              <Button
                size="small"
                variant="outlined"
                onClick={onRunAiReview}
                disabled={isAiReviewLoading || hasSyntaxErrors}
              >
                {isAiReviewLoading ? "AI reviewing..." : "Run AI review"}
              </Button>
            )}
            {onApplySafeCorrection && (
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={onApplySafeCorrection}
                disabled={!markdown.trim()}
              >
                Apply safe correction
              </Button>
            )}
          </Stack>
          {latestJob && (
            <Chip
              size="small"
              label={`PDF: ${latestJob.status}`}
              color={latestJob.status === "completed" ? "success" : "default"}
            />
          )}
        </Stack>
        <Popover
          open={insertFieldOpen}
          anchorEl={insertFieldAnchor}
          onClose={() => setInsertFieldAnchor(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          slotProps={{ paper: { className: "field-popover" } }}
        >
          <Stack gap={1.5}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                color="primary.main"
              >
                Create custom field
              </Typography>
              <IconButton
                size="small"
                onClick={() => setInsertFieldAnchor(null)}
                aria-label="Close insert field"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <TextField
                fullWidth
                label="Field name"
                placeholder="e.g. customerName"
                value={fieldNameInput}
                error={Boolean(fieldNameError)}
                helperText={fieldNameError ?? " "}
                onChange={(event) => {
                  setFieldNameInput(event.target.value);
                  setFieldNameError(null);
                }}
              />
              <FormControl fullWidth>
                <InputLabel id="field-type-label">Type</InputLabel>
                <Select<FieldType>
                  labelId="field-type-label"
                  value={fieldTypeInput}
                  label="Type"
                  onChange={(event: SelectChangeEvent<FieldType>) =>
                    updateFieldType(event.target.value)
                  }
                >
                  {fieldTypeOptions.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
              <TextField
                fullWidth
                type="number"
                label="Length"
                value={effectiveLengthInput}
                error={Boolean(fieldLengthError)}
                helperText={
                  fieldLengthError ??
                  (typeFixedLength[fieldTypeInput]
                    ? "Fixed length for selected type"
                    : "Max allowed length")
                }
                inputProps={{ min: 1, step: 1 }}
                disabled={Boolean(typeFixedLength[fieldTypeInput])}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">chars</InputAdornment>
                    ),
                  },
                }}
                onChange={(event) => {
                  setFieldLengthInput(event.target.value);
                  setFieldLengthError(null);
                }}
              />
              <FormControl fullWidth>
                <InputLabel id="field-required-label">Required</InputLabel>
                <Select<"true" | "false">
                  labelId="field-required-label"
                  value={fieldRequiredInput}
                  label="Required"
                  onChange={(event: SelectChangeEvent<"true" | "false">) =>
                    setFieldRequiredInput(event.target.value)
                  }
                >
                  <MenuItem value="true">true</MenuItem>
                  <MenuItem value="false">false</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {fieldTypeInput === "list" && (
              <Stack direction="column" gap={1.5}>
                <FormControl fullWidth>
                  <InputLabel id="list-source-label">List source</InputLabel>
                  <Select<"new" | "existing">
                    labelId="list-source-label"
                    value={listSource}
                    label="List source"
                    onChange={(event: SelectChangeEvent<"new" | "existing">) =>
                      setListSource(event.target.value)
                    }
                  >
                    <MenuItem value="existing">Use existing list</MenuItem>
                    <MenuItem value="new">Create new list</MenuItem>
                  </Select>
                </FormControl>

                {listSource === "existing" ? (
                  <>
                    <FormControl fullWidth>
                      <InputLabel id="existing-list-label">
                        Existing list
                      </InputLabel>
                      <Select
                        labelId="existing-list-label"
                        value={existingListName}
                        label="Existing list"
                        onChange={(event) => {
                          setExistingListName(event.target.value);
                          setListError(null);
                        }}
                      >
                        {templateLists.map((item) => (
                          <MenuItem key={item.listName} value={item.listName}>
                            {item.listName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {loadingTemplateLists && (
                      <Typography variant="body2" color="text.secondary">
                        Loading tenant lists...
                      </Typography>
                    )}
                    {selectedExistingList && (
                      <Typography variant="body2" color="text.secondary">
                        Values: {selectedExistingList.values.join(" | ")}
                      </Typography>
                    )}
                    {!loadingTemplateLists && templateLists.length === 0 && (
                      <Alert severity="info">
                        No existing lists available for this tenant.
                      </Alert>
                    )}
                  </>
                ) : (
                  <>
                    <TextField
                      fullWidth
                      label="List label"
                      placeholder="e.g. Contract type"
                      value={listNameInput}
                      onChange={(event) => {
                        setListNameInput(event.target.value);
                        setListError(null);
                      }}
                    />
                    <Stack gap={1}>
                      {listValuesInput.map((item, index) => (
                        <Stack key={item.id} direction="row" gap={1}>
                          <TextField
                            fullWidth
                            label={index === 0 ? "List values" : undefined}
                            placeholder={`Value ${index + 1}`}
                            value={item.value}
                            onChange={(event) => {
                              const next = listValuesInput.map((entry) =>
                                entry.id === item.id
                                  ? { ...entry, value: event.target.value }
                                  : entry,
                              );
                              setListValuesInput(next);
                              setListError(null);
                            }}
                          />
                          <IconButton
                            aria-label="Remove value"
                            disabled={listValuesInput.length === 1}
                            onClick={() =>
                              setListValuesInput((current) =>
                                current.filter((entry) => entry.id !== item.id),
                              )
                            }
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ alignSelf: "flex-start" }}
                        onClick={() =>
                          setListValuesInput((current) => [
                            ...current,
                            { id: crypto.randomUUID(), value: "" },
                          ])
                        }
                      >
                        Add value
                      </Button>
                    </Stack>
                  </>
                )}
                {listError && (
                  <FormHelperText error>{listError}</FormHelperText>
                )}
              </Stack>
            )}

            <Button
              variant="contained"
              onClick={confirmCreateField}
              sx={{ alignSelf: "flex-start" }}
            >
              Insert
            </Button>
          </Stack>
        </Popover>
      </Paper>

      {(aiWarnings.length > 0 || aiMeta) && (
        <Paper className="panel-shell">
          <Stack gap={1}>
            <Typography variant="subtitle2" color="primary.main">
              AI semantic review
            </Typography>
            {aiMeta && (
              <Typography variant="caption" color="text.secondary">
                Provider: {aiMeta.provider} · Model: {aiMeta.model ?? "-"} ·{" "}
                {aiMeta.latencyMs}ms
              </Typography>
            )}
            {aiWarnings.length === 0 ? (
              <Alert severity="success">
                No semantic inconsistencies found.
              </Alert>
            ) : (
              aiWarnings.map((warning) => (
                <Alert
                  key={`${warning.fieldName}-${warning.currentType}-${warning.suggestedType ?? "none"}-${warning.reason}`}
                  severity="warning"
                >
                  Possibile incoerenza semantica: il campo "{warning.fieldName}"
                  è dichiarato come {warning.currentType}
                  {warning.suggestedType
                    ? `, ma il contesto suggerisce ${warning.suggestedType}.`
                    : "."}{" "}
                  {warning.reason} (confidence:{" "}
                  {Math.round(warning.confidence * 100)}%)
                </Alert>
              ))
            )}
          </Stack>
        </Paper>
      )}

      {hasSyntaxErrors && (
        <Paper className="panel-shell">
          <Alert severity="info">
            AI semantic review skipped: fix syntax validation errors first.
          </Alert>
        </Paper>
      )}

      <Paper className="editor-paper">
        <Box
          sx={{
            position: "relative",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          <Box
            ref={overlayRef}
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              p: 0,
              pointerEvents: showOverlay ? "auto" : "none",
              userSelect: "none",
              whiteSpace: "pre-wrap",
              overflow: "hidden",
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              fontSize: "15px",
              lineHeight: 1.8,
              color: "#111827",
              opacity: showOverlay ? 1 : 0,
            }}
          >
            <Box sx={{ pointerEvents: hasActiveSelection ? "none" : "auto" }}>
              {highlightedOverlay}
            </Box>
          </Box>
          <TextField
            multiline
            minRows={22}
            fullWidth
            spellCheck={false}
            value={markdown}
            onChange={(event) => onChange(event.target.value)}
            onSelect={(event) => {
              const target = event.target as HTMLTextAreaElement;
              setSelection({
                start: target.selectionStart ?? 0,
                end: target.selectionEnd ?? 0,
              });
              syncOverlayScroll();
            }}
            onClick={(event) => {
              const target = event.target as HTMLTextAreaElement;
              setSelection({
                start: target.selectionStart ?? 0,
                end: target.selectionEnd ?? 0,
              });
              syncOverlayScroll();
            }}
            onKeyUp={(event) => {
              const target = event.target as HTMLTextAreaElement;
              setSelection({
                start: target.selectionStart ?? 0,
                end: target.selectionEnd ?? 0,
              });
              syncOverlayScroll();
            }}
            onFocus={() => setIsEditorFocused(true)}
            onBlur={() => {
              setIsEditorFocused(false);
              setSelection((current) => ({
                start: current.end,
                end: current.end,
              }));
            }}
            variant="standard"
            sx={{
              "& .MuiInputBase-root": {
                p: 0,
              },
              "& textarea": {
                position: "relative",
                zIndex: 1,
                padding: 0,
                background: "transparent",
                color: showOverlay ? "transparent" : "#111827",
                caretColor: "#111827",
                fontFamily: '"SFMono-Regular", Consolas, monospace',
                fontSize: "15px",
                lineHeight: 1.8,
              },
            }}
            slotProps={{
              input: { disableUnderline: true, className: "editor-input" },
              htmlInput: {
                spellCheck: false,
                ref: (element: HTMLTextAreaElement | null) => {
                  textareaRef.current = element;
                },
                onScroll: syncOverlayScroll,
              },
            }}
            placeholder="Write Markdown template or select a GitHub template"
          />
        </Box>
        <Box
          sx={{
            mt: 1.25,
            minHeight: 34,
            display: "flex",
            alignItems: "center",
          }}
        >
          {issueCount > 0 ? (
            <Button
              size="small"
              onClick={() => setShowIssueDetails((v) => !v)}
              sx={{ textTransform: "none", px: 0 }}
            >
              {`${issueCount} issues found · ${
                showIssueDetails ? "Hide details" : "Show details"
              }`}
            </Button>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No placeholder issues
            </Typography>
          )}
        </Box>
        <Collapse in={showIssueDetails && issueCount > 0}>
          <Stack gap={0.75} sx={{ mt: 0.25 }}>
            {issues.map((issue) => (
              <Alert
                key={`${issue.line}:${issue.column}:${issue.message}`}
                severity={issue.severity === "warning" ? "warning" : "error"}
                sx={{ py: 0 }}
              >
                {`Line ${issue.line}, column ${issue.column}: ${issue.message}`}
              </Alert>
            ))}
          </Stack>
        </Collapse>
      </Paper>
    </Stack>
  );
}
