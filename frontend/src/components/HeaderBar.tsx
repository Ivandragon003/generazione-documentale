import DescriptionIcon from "@mui/icons-material/Description";
import HistoryIcon from "@mui/icons-material/History";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import NoteAddIcon from "@mui/icons-material/NoteAdd";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SaveIcon from "@mui/icons-material/Save";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type { PdfJobDto, TemplateDto } from "../data/api";

interface HeaderBarProps {
  readonly template: TemplateDto | null;
  readonly isSaving: boolean;
  readonly onSave: () => void;
  readonly onGeneratePdf: () => void;
  readonly onGenerateDocx: () => void;
  readonly pdfJobs: PdfJobDto[];
  readonly canGeneratePdf?: boolean;
  readonly showSaveTemplate?: boolean;
  readonly onCreateTemplate?: () => void;
  readonly onDeleteTemplate?: () => void;
  readonly onOpenVersions?: () => void;
  readonly onOpenAudit?: () => void;
  readonly canSaveTemplate?: boolean;
  readonly showPdfStatus?: boolean;
  readonly showGenerateActions?: boolean;
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
  onCreateTemplate,
  onDeleteTemplate,
  onOpenVersions,
  onOpenAudit,
  canSaveTemplate = false,
  showPdfStatus = true,
  showGenerateActions = true,
}: HeaderBarProps) {
  const latestJob = pdfJobs[0];
  const [generateAnchor, setGenerateAnchor] = useState<HTMLElement | null>(
    null,
  );
  const generateOpen = Boolean(generateAnchor);

  return (
    <Paper className="header-bar header-surface" elevation={0}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={2}
        flexWrap="wrap"
      >
        <Stack direction="row" gap={2} alignItems="center">
          <Box className="doc-icon">DOC</Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              {template?.name ?? "No document"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {template?.updatedAt
                ? new Date(template.updatedAt).toLocaleDateString("en-US")
                : "-"}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          {onCreateTemplate && (
            <Button
              variant="outlined"
              startIcon={<NoteAddIcon />}
              onClick={onCreateTemplate}
              disabled={isSaving}
            >
              Create template
            </Button>
          )}
          <Divider orientation="vertical" flexItem className="header-divider" />
          {onDeleteTemplate && (
            <Button
              variant="outlined"
              color="error"
              onClick={onDeleteTemplate}
              disabled={isSaving || !template}
            >
              Delete
            </Button>
          )}
          {onOpenVersions && (
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={onOpenVersions}
              disabled={!template}
            >
              Versions
            </Button>
          )}
          {onOpenAudit && (
            <Button
              variant="outlined"
              startIcon={<ManageSearchIcon />}
              onClick={onOpenAudit}
            >
              Audit
            </Button>
          )}
          {showPdfStatus && latestJob && (
            <Tooltip
              title={`Latest job: ${latestJob.status} - ${latestJob.createdAt}`}
            >
              <Chip
                icon={<HistoryIcon />}
                label={`PDF: ${latestJob.status}`}
                size="small"
                color={latestJob.status === "completed" ? "success" : "default"}
              />
            </Tooltip>
          )}

          {showGenerateActions && (
            <>
              <Tooltip
                title={canGeneratePdf ? "Generate file" : "Select a template"}
              >
                <span>
                  <Button
                    variant="outlined"
                    startIcon={<PictureAsPdfIcon />}
                    endIcon={<KeyboardArrowDownIcon />}
                    onClick={(event) => setGenerateAnchor(event.currentTarget)}
                    disabled={!canGeneratePdf || isSaving}
                  >
                    Generate
                  </Button>
                </span>
              </Tooltip>
              <Menu
                anchorEl={generateAnchor}
                open={generateOpen}
                onClose={() => setGenerateAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    setGenerateAnchor(null);
                    onGeneratePdf();
                  }}
                >
                  <PictureAsPdfIcon
                    fontSize="small"
                    style={{ marginRight: 8 }}
                  />
                  PDF
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setGenerateAnchor(null);
                    onGenerateDocx();
                  }}
                >
                  <DescriptionIcon
                    fontSize="small"
                    style={{ marginRight: 8 }}
                  />
                  DOCX
                </MenuItem>
              </Menu>
            </>
          )}

          {showSaveTemplate && (
            <Button
              variant="contained"
              className="primary-action-btn"
              startIcon={
                isSaving ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SaveIcon />
                )
              }
              onClick={onSave}
              disabled={isSaving || !canSaveTemplate}
            >
              {isSaving ? "Saving..." : "Save Template"}
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
