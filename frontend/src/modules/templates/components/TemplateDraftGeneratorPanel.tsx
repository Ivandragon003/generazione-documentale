import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { TemplateDraftGenerationReportDto } from "../../../data/api";

type Props = {
  readonly description: string;
  readonly language: string;
  readonly runSemanticAudit: boolean;
  readonly isGenerating: boolean;
  readonly result: TemplateDraftGenerationReportDto | null;
  readonly onDescriptionChange: (value: string) => void;
  readonly onLanguageChange: (value: string) => void;
  readonly onRunSemanticAuditChange: (value: boolean) => void;
  readonly onGenerate: () => void;
  readonly onApplyDraft: () => void;
  readonly onApplySafeCorrectionToDraft: () => void;
};

export function TemplateDraftGeneratorPanel({
  description,
  language,
  runSemanticAudit,
  isGenerating,
  result,
  onDescriptionChange,
  onLanguageChange,
  onRunSemanticAuditChange,
  onGenerate,
  onApplyDraft,
  onApplySafeCorrectionToDraft,
}: Props) {
  const validFieldsCount =
    result?.placeholderAnalysis?.extractedFields.length ?? 0;
  const invalidPlaceholderCount =
    result?.placeholderAnalysis?.invalidPlaceholders.length ?? 0;
  const syntaxErrorCount = result?.deterministic.errors.length ?? 0;
  const repairableErrorCount =
    result?.placeholderAnalysis?.repairableErrors.length ?? 0;
  const suggestedCorrectionsCount = repairableErrorCount;
  const blockingErrorCount =
    result?.placeholderAnalysis?.blockingErrorsAfterRepair ??
    result?.deterministic.errors.filter((issue) => issue.blocking).length ??
    0;
  const repairAppliedCount = result?.repair?.repairAppliedCount ?? 0;
  const remainingErrors = result?.repair?.errorsAfterRepair ?? syntaxErrorCount;
  const finalValidationPassed = result?.repair?.finalValidationPassed ?? false;

  const finalStatus = !result
    ? "-"
    : result.savable
      ? result.repair?.applied
        ? "Valid after repair"
        : "Valid"
      : "Not valid";

  const hasNonRepairableErrors =
    (result?.placeholderAnalysis?.nonRepairableErrors.length ?? 0) > 0;

  const combinedIssues = result
    ? [
        ...result.deterministic.errors,
        ...result.deterministic.warnings.map((warning) => ({
          ...warning,
          severity: warning.severity ?? "warning",
        })),
      ]
    : [];

  return (
    <Paper className="panel-shell">
      <Stack gap={1.5}>
        <Typography variant="subtitle2" color="primary.main">
          AI draft generation (experimental)
        </Typography>
        <TextField
          label="Document description"
          multiline
          minRows={3}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Describe the document structure and required fields"
        />
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
          <Select
            size="small"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="it">Italiano (it)</MenuItem>
            <MenuItem value="en">English (en)</MenuItem>
          </Select>
          <FormControlLabel
            control={
              <Switch
                checked={runSemanticAudit}
                onChange={(event) =>
                  onRunSemanticAuditChange(event.target.checked)
                }
              />
            }
            label="Run semantic review after generation"
          />
          <Button
            variant="contained"
            onClick={onGenerate}
            disabled={isGenerating || description.trim().length === 0}
          >
            {isGenerating ? "Generating..." : "Generate draft"}
          </Button>
        </Stack>

        {result && (
          <Stack gap={1}>
            <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
              <Chip
                size="small"
                label={result.savable ? "Savable" : "Not savable"}
                color={result.savable ? "success" : "error"}
              />
              <Typography variant="caption" color="text.secondary">
                AI provider: {result.ai.provider} · model:{" "}
                {result.ai.model ?? "-"} · {result.ai.latencyMs}ms
              </Typography>
            </Stack>

            {result.ai.failed && (
              <Alert severity="error">
                Impossibile contattare Ollama.{" "}
                {result.ai.error ?? "Errore sconosciuto."}
              </Alert>
            )}

            <TextField
              label="Generated markdown"
              multiline
              minRows={10}
              value={result.content}
              InputProps={{ readOnly: true }}
            />
            <Box>
              <Stack direction="row" gap={1} flexWrap="wrap">
                {(repairableErrorCount > 0 || result.repair?.applied) && (
                  <Button
                    variant="contained"
                    color="warning"
                    onClick={onApplySafeCorrectionToDraft}
                    disabled={!result.content.trim()}
                  >
                    Apply safe corrections
                  </Button>
                )}
                {hasNonRepairableErrors && (
                  <Button
                    variant="contained"
                    color="error"
                    onClick={onGenerate}
                    disabled={isGenerating || description.trim().length === 0}
                  >
                    Regenerate output
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={onApplyDraft}
                  disabled={!result.content.trim()}
                >
                  Load draft in editor
                </Button>
              </Stack>
            </Box>

            <Paper variant="outlined" className="draft-summary-card">
              <Stack
                direction={{ xs: "column", md: "row" }}
                gap={1}
                flexWrap="wrap"
              >
                <Chip
                  label={`Valid fields: ${validFieldsCount}`}
                  size="small"
                />
                <Chip
                  label={`Invalid placeholders: ${invalidPlaceholderCount}`}
                  size="small"
                />
                <Chip
                  label={`Syntax errors: ${syntaxErrorCount}`}
                  size="small"
                />
                <Chip
                  label={`Repairable errors: ${repairableErrorCount}`}
                  size="small"
                  color={repairableErrorCount > 0 ? "warning" : "default"}
                />
                <Chip
                  label={`Correzioni suggerite: ${suggestedCorrectionsCount}`}
                  size="small"
                  color={suggestedCorrectionsCount > 0 ? "warning" : "default"}
                />
                <Chip
                  label={`Correzioni applicate: ${repairAppliedCount}`}
                  size="small"
                  color={repairAppliedCount > 0 ? "success" : "default"}
                />
                <Chip
                  label={`Errori rimanenti: ${remainingErrors}`}
                  size="small"
                  color={remainingErrors > 0 ? "error" : "success"}
                />
                <Chip
                  label={`Blocking errors: ${blockingErrorCount}`}
                  size="small"
                  color={blockingErrorCount > 0 ? "error" : "default"}
                />
                <Chip
                  label={`Final status: ${finalStatus}`}
                  size="small"
                  color={result.savable ? "success" : "error"}
                />
              </Stack>
            </Paper>

            {remainingErrors === 0 &&
              repairAppliedCount > 0 &&
              finalValidationPassed && (
                <Alert severity="success">
                  Template valido dopo correzione
                </Alert>
              )}

            {combinedIssues.length > 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Severity</TableCell>
                      <TableCell>Error code</TableCell>
                      <TableCell>Placeholder</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Suggestion</TableCell>
                      <TableCell>Auto-repair</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {combinedIssues.map((issue) => {
                      const severityLabel =
                        issue.severity ??
                        (issue.blocking ? "error" : "warning");
                      return (
                        <TableRow
                          key={`${issue.code}-${issue.line}-${issue.message}`}
                        >
                          <TableCell>
                            <Chip
                              size="small"
                              label={severityLabel}
                              color={
                                severityLabel === "error"
                                  ? "error"
                                  : severityLabel === "warning"
                                    ? "warning"
                                    : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>{issue.code}</TableCell>
                          <TableCell>{issue.placeholder ?? "-"}</TableCell>
                          <TableCell>{issue.message}</TableCell>
                          <TableCell>{issue.suggestion ?? "-"}</TableCell>
                          <TableCell>
                            {issue.autoFixable ? "Yes" : "No"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">
                  Show technical details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack gap={1.5}>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      label={`Invalid not extracted: ${
                        result.placeholderAnalysis
                          ?.nonExtractedInvalidPlaceholders.length ?? 0
                      }`}
                    />
                    <Chip
                      size="small"
                      label={`Repairable issues: ${
                        result.placeholderAnalysis?.repairableErrors.length ?? 0
                      }`}
                    />
                    <Chip
                      size="small"
                      label={`Non-repairable issues: ${
                        result.placeholderAnalysis?.nonRepairableErrors
                          .length ?? 0
                      }`}
                    />
                  </Stack>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Field name</TableCell>
                          <TableCell>Type</TableCell>
                          <TableCell>Position</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(
                          result.placeholderAnalysis?.extractedFields ?? []
                        ).map((field) => {
                          const fieldLine = result.fields.find(
                            (entry) =>
                              entry.name === field.name &&
                              entry.type === field.type,
                          )?.line;
                          return (
                            <TableRow
                              key={`${field.name}-${field.type}-${field.raw}`}
                            >
                              <TableCell>{field.name}</TableCell>
                              <TableCell>{field.type}</TableCell>
                              <TableCell>
                                {fieldLine ? `Line ${fieldLine}` : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {result.semanticAudit.warnings.map((warning) => (
              <Alert
                key={`sem-${warning.fieldName}-${warning.reason}`}
                severity="warning"
              >
                Semantic warning on "{warning.fieldName}": {warning.reason}
              </Alert>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
