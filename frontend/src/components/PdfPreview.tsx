import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  type FieldValue,
  type FieldValueMap,
  getLatestPdfDownloadUrl,
  type PdfJobDto,
} from "../data/api";
import { type NormalizedField, stableStringify } from "../utils/template";
import { DynamicDocument } from "./DynamicDocument";

type Props = {
  markdown: string;
  fields: NormalizedField[];
  values: FieldValueMap;
  errors?: Record<string, string>;
  readOnly?: boolean;
  showTypeHints?: boolean;
  onChange?: (name: string, value: FieldValue) => void;
  pdfJobs?: PdfJobDto[];
  templateId?: string;
  documentName?: string;
  templateContentHash?: string;
};

function jobStatusColor(
  status: PdfJobDto["status"],
): "default" | "warning" | "success" | "error" {
  if (status === "completed") return "success";
  if (status === "failed") return "error";
  if (status === "running") return "warning";
  return "default";
}

function jobStatusLabel(status: PdfJobDto["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "running") return "Running...";
  return "Queued";
}

export function PdfPreview({
  markdown,
  fields,
  values,
  errors,
  readOnly = true,
  showTypeHints = false,
  onChange,
  pdfJobs = [],
  templateId,
  documentName,
  templateContentHash,
}: Readonly<Props>) {
  const currentValuesSignature = stableStringify(values);
  const latestCompleted = [...pdfJobs]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .find(
      (job) =>
        job.status === "completed" &&
        job.templateContentHash === templateContentHash &&
        stableStringify(job.fieldValues ?? {}) === currentValuesSignature,
    );

  const latestJob = pdfJobs[0];
  const downloadUrl =
    latestCompleted && templateId
      ? getLatestPdfDownloadUrl(templateId, values)
      : null;
  const isGenerating =
    latestJob?.status === "queued" || latestJob?.status === "running";

  return (
    <Stack gap={2}>
      <Paper className="panel-shell">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            {pdfJobs.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No generated PDF
              </Typography>
            )}

            {isGenerating && latestJob && (
              <Stack direction="row" alignItems="center" gap={1}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  {latestJob.status === "running"
                    ? "Generating..."
                    : "Queued..."}
                </Typography>
              </Stack>
            )}

            {pdfJobs.slice(0, 4).map((job) => (
              <Tooltip
                key={job.id}
                title={
                  job.errorMessage
                    ? `Error: ${job.errorMessage}`
                    : `${new Date(job.createdAt).toLocaleString("en-US")}`
                }
              >
                <Chip
                  label={`PDF ${jobStatusLabel(job.status)}`}
                  size="small"
                  color={jobStatusColor(job.status)}
                />
              </Tooltip>
            ))}
          </Stack>

          <Stack direction="row" gap={1}>
            <Tooltip title={downloadUrl ? "Print PDF" : "No PDF available"}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  disabled={!downloadUrl}
                  onClick={() => {
                    if (!downloadUrl) return;
                    const iframe = document.createElement("iframe");
                    iframe.style.display = "none";
                    iframe.src = downloadUrl;
                    document.body.appendChild(iframe);
                    iframe.onload = () => iframe.contentWindow?.print();
                  }}
                >
                  Print
                </Button>
              </span>
            </Tooltip>

            <Tooltip title={downloadUrl ? "Download PDF" : "No PDF available"}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  disabled={!downloadUrl}
                  onClick={() => {
                    if (!downloadUrl) return;
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = `${documentName ?? "document"}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  }}
                >
                  Download PDF
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {latestJob?.status === "failed" && latestJob.errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Generation failed:</strong> {latestJob.errorMessage}
          </Alert>
        )}
        {!downloadUrl && pdfJobs.some((job) => job.status === "completed") && (
          <Alert severity="info" sx={{ mt: 2 }}>
            PDF not generated yet for this template version and field set.
          </Alert>
        )}
      </Paper>

      <Paper className="preview-sheet">
        <DynamicDocument
          markdown={markdown}
          fields={fields}
          values={values}
          errors={errors}
          readOnly={readOnly}
          showTypeHints={showTypeHints}
          onChange={onChange}
        />
      </Paper>
    </Stack>
  );
}
