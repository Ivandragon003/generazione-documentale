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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PdfJobDto } from "../data/api";

type Props = {
  content: string;
  pdfJobs?: PdfJobDto[];
  templateId?: string;
  documentName?: string;
};

const BASE = `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api`;

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
  content,
  pdfJobs = [],
  templateId,
  documentName,
}: Props) {
  // Prendi il job più recente completato
  const latestCompleted = pdfJobs.find((j) => j.status === "completed");
  // Prendi il job più recente in assoluto (qualsiasi stato)
  const latestJob = pdfJobs[0];

  // L'URL di download richiede un UUID valido del template
  const isValidUuid = (s?: string) =>
    Boolean(
      s &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          s,
        ),
    );

  const downloadUrl =
    latestCompleted && templateId && isValidUuid(templateId)
      ? `${BASE}/templates/${templateId}/pdf/jobs/${latestCompleted.id}/download`
      : null;

  const isGenerating =
    latestJob?.status === "queued" || latestJob?.status === "running";

  return (
    <Stack gap={2}>
      {/* Barra di stato PDF */}
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

            {isGenerating && (
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
                    iframe.onload = () => {
                      iframe.contentWindow?.print();
                    };
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
                    // Scarica tramite click su link — più affidabile di window.open
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

        {/* Mostra errore se l'ultimo job è fallito */}
        {latestJob?.status === "failed" && latestJob.errorMessage && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Generazione fallita:</strong> {latestJob.errorMessage}
          </Alert>
        )}

        {/* Avviso se templateId non è UUID (template GitHub non salvato) */}
        {templateId && !isValidUuid(templateId) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Salva il template come copia locale per poter scaricare il PDF.
          </Alert>
        )}
      </Paper>

      {/* Anteprima Markdown */}
      <Paper className="preview-sheet">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Box>
            <Box className="logo-box">LOGO</Box>
            <Typography variant="caption" color="text.secondary">
              Confidenziale · v1.0
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
        <Box className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </Box>
      </Paper>
    </Stack>
  );
}
