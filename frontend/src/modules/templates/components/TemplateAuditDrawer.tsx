import HistoryEduOutlinedIcon from "@mui/icons-material/HistoryEduOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  List,
  ListItem,
  Stack,
  Typography,
} from "@mui/material";
import type { AuditLogDto } from "../../../data/api";

interface TemplateAuditDrawerProps {
  readonly open: boolean;
  readonly loading: boolean;
  readonly templateName: string;
  readonly events: AuditLogDto[];
  readonly onClose: () => void;
}

function toLabel(eventType: string): string {
  const normalized = eventType.replaceAll(".", " ").trim();
  if (normalized === "template sync completed") return "sync completed";
  return normalized;
}

function normalizeTemplateRef(event: AuditLogDto): string | null {
  const fromPayload = event.payload?.path;
  if (typeof fromPayload === "string" && fromPayload.trim().length > 0) {
    return fromPayload;
  }
  const raw = event.template_id?.trim();
  if (!raw) return null;
  const withoutPrefix = raw.startsWith("github:") ? raw.slice(7) : raw;
  const parts = withoutPrefix.split("/");
  if (parts.length <= 1) return withoutPrefix;
  return parts.slice(1).join("/");
}

export function TemplateAuditDrawer({
  open,
  loading,
  templateName,
  events,
  onClose,
}: TemplateAuditDrawerProps) {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box className="template-audit-drawer">
        <Typography variant="overline" className="template-audit-overline">
          Audit Trail
        </Typography>
        <Typography variant="h6" fontWeight={700}>
          {templateName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Change events, version history, and PDF jobs
        </Typography>
        <Divider sx={{ my: 2 }} />

        {loading ? (
          <Box className="template-audit-loading">
            <CircularProgress size={22} />
          </Box>
        ) : events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No audit events available for this template.
          </Typography>
        ) : (
          <List disablePadding>
            {events.map((event) => (
              <ListItem key={event.id} className="template-audit-item">
                <Stack spacing={1.1} width="100%">
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Chip
                      size="small"
                      icon={<HistoryEduOutlinedIcon />}
                      label={toLabel(event.event_type)}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(event.created_at).toLocaleString("en-US")}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" gap={0.7}>
                    <PersonOutlineIcon fontSize="inherit" />
                    <Typography variant="body2" color="text.secondary">
                      {event.actor || "system"}
                    </Typography>
                  </Stack>
                  {normalizeTemplateRef(event) && (
                    <Typography variant="caption" className="template-audit-id">
                      {normalizeTemplateRef(event)}
                    </Typography>
                  )}
                </Stack>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Drawer>
  );
}
