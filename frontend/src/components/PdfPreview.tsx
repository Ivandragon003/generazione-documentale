import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import {
  Box,
  Button,
  Chip,
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
  documentId?: string;
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

export function PdfPreview({
  content,
  pdfJobs = [],
  documentId,
  documentName,
}: Props) {
  const latestCompleted = pdfJobs.find((j) => j.status === "completed");
  const downloadUrl =
    latestCompleted && documentId
      ? `${BASE}/documents/${documentId}/pdf/jobs/${latestCompleted.id}/download`
      : null;

  return (
    <Stack gap={2}>
      <Paper className="panel-shell">
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            {pdfJobs.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nessun PDF generato
              </Typography>
            )}
            {pdfJobs.slice(0, 3).map((job) => (
              <Tooltip
                key={job.id}
                title={`${job.createdAt}${job.errorMessage ? ` — ${job.errorMessage}` : ""}`}
              >
                <Chip
                  label={`PDF ${job.status}`}
                  size="small"
                  color={jobStatusColor(job.status)}
                />
              </Tooltip>
            ))}
          </Stack>
          <Stack direction="row" gap={1}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => window.print()}
            >
              Stampa
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              disabled={!downloadUrl}
              href={downloadUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
            >
              Scarica
            </Button>
          </Stack>
        </Stack>
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
              Confidenziale · v1.0
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="body2">
              Documento: <strong>{documentName ?? "Document Editor"}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {latestCompleted
                ? `Generato: ${new Date(latestCompleted.createdAt).toLocaleDateString("it-IT")}`
                : "Non ancora generato"}
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
