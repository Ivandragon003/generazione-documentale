import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
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
  if (status === "completed") return "Completato";
  if (status === "failed") return "Fallito";
  if (status === "running") return "In corso...";
  return "In coda";
}

export function PdfPreview({
  markdown,
  fields,
  values,
  pdfJobs = [],
  templateId,
  documentName,
  templateContentHash,
}: Props) {
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
                Nessun PDF generato
              </Typography>
            )}

            {isGenerating && latestJob && (
              <Stack direction="row" alignItems="center" gap={1}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  {latestJob.status === "running"
                    ? "Generazione in corso..."
                    : "In coda..."}
                </Typography>
              </Stack>
            )}

            {pdfJobs.slice(0, 4).map((job) => (
              <Tooltip
                key={job.id}
                title={
                  job.errorMessage
                    ? `Errore: ${job.errorMessage}`
                    : `${new Date(job.createdAt).toLocaleString("it-IT")}`
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
            <Tooltip
              title={downloadUrl ? "Stampa PDF" : "Nessun PDF disponibile"}
            >
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
                  Stampa
                </Button>
              </span>
            </Tooltip>

            <Tooltip
              title={downloadUrl ? "Scarica PDF" : "Nessun PDF disponibile"}
            >
              <span>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  disabled={!downloadUrl}
                  onClick={() => {
                    if (!downloadUrl) return;
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = `${documentName ?? "documento"}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                >
                  Scarica PDF
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {latestJob?.status === "failed" && latestJob.errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Generazione fallita:</strong> {latestJob.errorMessage}
          </Alert>
        )}
        {!downloadUrl && pdfJobs.some((job) => job.status === "completed") && (
          <Alert severity="info" sx={{ mt: 2 }}>
            PDF non ancora generato per questa versione del template e questi
            campi.
          </Alert>
        )}
      </Paper>

      <Paper className="preview-sheet">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Box className="logo-box">LOGO</Box>
            <Typography variant="caption" color="text.secondary">
              Confidenziale - v1.0
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="body2">
              Documento: <strong>{documentName ?? "Document Editor"}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {latestCompleted
                ? `PDF generato: ${new Date(latestCompleted.createdAt).toLocaleDateString("it-IT")}`
                : "PDF non ancora generato"}
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ my: 4 }} />
        <DynamicDocument
          markdown={markdown}
          fields={fields}
          values={values}
          readOnly
        />
      </Paper>
    </Stack>
  );
}
