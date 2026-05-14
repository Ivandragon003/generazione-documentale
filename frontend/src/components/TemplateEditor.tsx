import AddIcon from "@mui/icons-material/Add";
import {
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type Props = {
  markdown: string;
  onChange: (value: string) => void;
  placeholders: string[];
  added: string[];
  removed: string[];
};

export function TemplateEditor({
  markdown,
  onChange,
  placeholders,
  added,
  removed,
}: Props) {
  function handleCreateField() {
    const fieldName = window.prompt("Field name (e.g. customer_name):");
    if (!fieldName) return;

    const normalized = fieldName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    if (!normalized) {
      alert("Invalid field name.");
      return;
    }

    const type = window.prompt(
      "Field type (text, textarea, date, number, boolean, select, table, list):",
      "text",
    );

    const separator = markdown.length > 0 ? "\n" : "";
    const placeholder =
      type && type !== "text"
        ? `{{${normalized}:${type}}}`
        : `{{${normalized}}}`;
    onChange(`${markdown}${separator}${placeholder}`);
  }

  return (
    <Stack gap={2}>
      <Paper className="panel-shell">
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <Button
            size="small"
            variant="text"
            onClick={() => onChange(`**${markdown}**`)}
            title="Grassetto"
          >
            B
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => onChange(`*${markdown}*`)}
            title="Corsivo"
          >
            I
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleCreateField}
          >
            Create field
          </Button>
        </Stack>
      </Paper>

      <Paper className="editor-paper">
        <TextField
          multiline
          minRows={22}
          fullWidth
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          variant="standard"
          InputProps={{ disableUnderline: true, className: "editor-input" }}
          placeholder="Write Markdown template or select a GitHub template"
        />
      </Paper>

      <Paper className="panel-shell">
        <Typography variant="subtitle1" gutterBottom>
          Detected placeholders
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {placeholders.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {"No {{field}} placeholder found"}
            </Typography>
          )}
          {placeholders.map((field) => (
            <Chip
              key={field}
              label={`{{${field}}}`}
              color="primary"
              variant="outlined"
            />
          ))}
        </Stack>
        {(added.length > 0 || removed.length > 0) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Structure changed: added{" "}
            <strong>{added.join(", ") || "none"}</strong>, removed{" "}
            <strong>{removed.join(", ") || "none"}</strong>. On save, a new
            template will be created.
          </Alert>
        )}
      </Paper>
    </Stack>
  );
}
