import HistoryIcon from "@mui/icons-material/History";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import type { DocumentDto, PdfJobDto, TemplateDto } from "../data/api";

interface HeaderBarProps {
  document: DocumentDto | null;
  template: TemplateDto | null;
  isSaving: boolean;
  onSave: () => void;
  onGeneratePdf: () => void;
  pdfJobs: PdfJobDto[];
}

function statusColor(
  s: DocumentDto["status"],
): "default" | "warning" | "success" | "secondary" {
  if (s === "generated" || s === "published") return "success";
  if (s === "archived") return "default";
  return "secondary"; // draft
}

function statusLabel(s: DocumentDto["status"] | undefined): string {
  switch (s) {
    case "draft":     return "Bozza";
    case "generated": return "Generato";
    case "published": return "Pubblicato";
    case "archived":  return "Archiviato";
    default:          return "Non Generato";
  }
}

export function HeaderBar({
  document,
  template,
  isSaving,
  onSave,
  onGeneratePdf,
  pdfJobs,
}: HeaderBarProps) {
  const latestJob = pdfJobs[0];

  // updatedAt (camelCase) — allineato a DocumentDto
  const lastGenerated = document?.updatedAt
    ? new Date(document.updatedAt).toLocaleDateString("it-IT")
    : "—";

  return (
    <Box className="header-bar">
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
      >
        <Stack direction="row" gap={2} alignItems="center">
          <Box className="doc-icon">DOC</Box>
          <Box>
            <Typography variant="h5">
              {document?.name ?? template?.name ?? "Nessun documento"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {template?.name ?? "—"} · {lastGenerated}
            </Typography>
            <Chip
              label={statusLabel(document?.status)}
              color={statusColor(document?.status ?? "draft")}
              size="small"
              sx={{ mt: 1 }}
            />
          </Box>
        </Stack>

        <Stack direction="row" gap={1} alignItems="center">
          {latestJob && (
            <Tooltip
              title={`Ultimo job: ${latestJob.status} — ${latestJob.createdAt}`}
            >
              <Chip
                icon={<HistoryIcon />}
                label={`PDF: ${latestJob.status}`}
                size="small"
                color={latestJob.status === "completed" ? "success" : "default"}
              />
            </Tooltip>
          )}

          <Tooltip title="Genera PDF">
            <span>
              <Button
                variant="outlined"
                startIcon={<PictureAsPdfIcon />}
                onClick={onGeneratePdf}
                disabled={!document || isSaving}
              >
                Genera PDF
              </Button>
            </span>
          </Tooltip>

          <Button
            variant="contained"
            startIcon={
              isSaving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <SaveIcon />
              )
            }
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "Salvataggio…" : "Salva"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
