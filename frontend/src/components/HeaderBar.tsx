import DescriptionIcon from "@mui/icons-material/Description";
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
  readonly template: TemplateDto | null;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onGeneratePdf: () => void;
  readonly onGenerateDocx: () => void;
  readonly pdfJobs: PdfJobDto[];
  readonly canGeneratePdf?: boolean;
  /** Show the "Save Template" button only when the Template tab is active */
  readonly showSaveTemplate?: boolean;
}

export function HeaderBar({
  template,
  isSaving,
  onSave,
  onGeneratePdf,
  onGenerateDocx,
  pdfJobs,
  canGeneratePdf = false,
  showSaveTemplate = true,
}: HeaderBarProps) {
  const latestJob = pdfJobs[0];

  const pdfTooltip = canGeneratePdf ? "Generate PDF" : "Select a template";

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
              {template?.name ?? "No document"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {template?.updatedAt
                ? new Date(template.updatedAt).toLocaleDateString("it-IT")
                : "—"}
            </Typography>
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
                Generate PDF
              </Button>
            </span>
          </Tooltip>
          <Tooltip
            title={canGeneratePdf ? "Generate DOCX" : "Select a template"}
          >
            <span>
              <Button
                variant="outlined"
                startIcon={<DescriptionIcon />}
                onClick={onGenerateDocx}
                disabled={!canGeneratePdf || isSaving}
              >
                Generate DOCX
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
              {isSaving ? "Salvataggio\u2026" : "Save Template"}
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
