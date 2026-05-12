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
import type { PdfJobDto, TemplateDto } from "../data/api";

interface HeaderBarProps {
  template: TemplateDto | null;
  isSaving: boolean;
  onSave: () => void;
  onGeneratePdf: () => void;
  pdfJobs: PdfJobDto[];
  canGeneratePdf?: boolean;
  /** Mostra il pulsante "Salva Template" solo quando si è nella tab Template */
  showSaveTemplate?: boolean;
}

export function HeaderBar({
  template,
  isSaving,
  onSave,
  onGeneratePdf,
  pdfJobs,
  canGeneratePdf = false,
  showSaveTemplate = true,
}: HeaderBarProps) {
  const latestJob = pdfJobs[0];

  const pdfTooltip = canGeneratePdf
    ? "Genera PDF"
    : "Salva prima il template per abilitare la generazione PDF";

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
              {template?.name ?? "Nessun documento"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {template?.updatedAt
                ? new Date(template.updatedAt).toLocaleDateString("it-IT")
                : "—"}
            </Typography>
            <Chip
              label={template?.status === "published" ? "Pubblicato" : "Bozza"}
              color={template?.status === "published" ? "success" : "secondary"}
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

          <Tooltip title={pdfTooltip}>
            <span>
              <Button
                variant="outlined"
                startIcon={<PictureAsPdfIcon />}
                onClick={onGeneratePdf}
                disabled={!canGeneratePdf || isSaving}
              >
                Genera PDF
              </Button>
            </span>
          </Tooltip>

          {showSaveTemplate && (
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
              {isSaving ? "Salvataggio\u2026" : "Salva Template"}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
