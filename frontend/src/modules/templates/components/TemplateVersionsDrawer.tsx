import RestoreIcon from "@mui/icons-material/Restore";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import type { TemplateVersionDto } from "../../../data/api";

function hideCommitHash(message: string): string {
  return message
    .replace(/\b[0-9a-f]{7,40}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type Props = {
  open: boolean;
  templateName: string;
  versions: TemplateVersionDto[];
  currentCommitSha?: string | null;
  selectedSha?: string | null;
  onClose: () => void;
  onSelectVersion: (version: TemplateVersionDto) => void;
  onRestoreVersion: (version: TemplateVersionDto) => void;
};

export function TemplateVersionsDrawer({
  open,
  templateName,
  versions,
  currentCommitSha,
  selectedSha,
  onClose,
  onSelectVersion,
  onRestoreVersion,
}: Props) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box sx={{ width: 440, p: 2.5 }} className="versions-drawer">
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: "#64748b" }}
        >
          TEMPLATE VERSIONS
        </Typography>
        <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
          {templateName}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack gap={1.25}>
          {versions.map((version, index) => {
            const isCurrent = currentCommitSha
              ? currentCommitSha.startsWith(version.sha)
              : index === 0;
            const versionLabel = `v${Math.max(1, versions.length - index)}.0`;
            const isSelected = selectedSha
              ? selectedSha === version.sha
              : isCurrent;
            return (
              <Box
                key={version.sha}
                className="template-version-item"
                sx={{
                  cursor: "pointer",
                  borderColor: isSelected ? "#2b6ce7" : undefined,
                  boxShadow: isSelected
                    ? "0 0 0 1px rgba(43,108,231,0.2) inset"
                    : undefined,
                }}
                onClick={() => onSelectVersion(version)}
              >
                <Stack direction="row" alignItems="center" gap={1}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: isCurrent ? "#2b6ce7" : "#c4cad4",
                    }}
                  />
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, color: "#0f172a" }}
                  >
                    {versionLabel}
                    {isCurrent ? " - current" : ""}
                  </Typography>
                  {isCurrent && (
                    <Chip size="small" color="success" label="Current" />
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.25 }}
                >
                  Modified by {version.author ?? "unknown"} ·{" "}
                  {version.committedAt
                    ? new Date(version.committedAt).toLocaleString("en-US")
                    : "-"}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: "#334155" }}>
                  {hideCommitHash(version.message)}
                </Typography>
                <Stack direction="row" gap={1} sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    startIcon={<RestoreIcon />}
                    disabled={isCurrent}
                    onClick={(event) => {
                      event.stopPropagation();
                      onRestoreVersion(version);
                    }}
                  >
                    Restore
                  </Button>
                </Stack>
              </Box>
            );
          })}
          {versions.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No versions found.
            </Typography>
          )}
        </Stack>
      </Box>
    </Drawer>
  );
}
