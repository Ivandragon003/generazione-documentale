import AddIcon from "@mui/icons-material/Add";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { FieldType } from "../data/api";

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
  const [fieldNameInput, setFieldNameInput] = useState("");
  const [fieldTypeInput, setFieldTypeInput] = useState<FieldType>("text");
  const [fieldNameError, setFieldNameError] = useState<string | null>(null);

  const fieldTypeOptions: FieldType[] = [
    "string",
    "text",
    "number",
    "integer",
    "date",
    "currency",
    "percentage",
    "boolean",
    "email",
    "phone",
  ];

  const detectedPlaceholders = useMemo(() => {
    const regex = /\{\{(?:([a-z]+):)?([a-z_][a-z0-9_]*)\}\}/g;
    const found = new Map<string, string>();
    for (const match of markdown.matchAll(regex)) {
      const type = match[1] ?? "string";
      const name = match[2];
      if (!found.has(name)) found.set(name, type);
    }
    return Array.from(found.entries()).map(([name, type]) => ({ name, type }));
  }, [markdown]);

  function normalizeFieldName(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }

  function confirmCreateField(): void {
    const normalized = normalizeFieldName(fieldNameInput);
    if (!normalized) {
      setFieldNameError("Enter a valid variable name (e.g. customer_name).");
      return;
    }

    const separator = markdown.length > 0 ? "\n" : "";
    const placeholder = `{{${fieldTypeInput}:${normalized}}}`;
    onChange(`${markdown}${separator}${placeholder}`);
    setFieldNameInput("");
    setFieldTypeInput("text");
    setFieldNameError(null);
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
            onClick={confirmCreateField}
          >
            Insert field
          </Button>
        </Stack>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          gap={2}
          sx={{ mt: 1.5 }}
          alignItems={{ xs: "stretch", sm: "flex-start" }}
        >
          <TextField
            fullWidth
            label="Variable"
            placeholder="customer_name"
            value={fieldNameInput}
            error={Boolean(fieldNameError)}
            helperText={
              fieldNameError ??
              "Letters, numbers and underscore. Spaces become underscore."
            }
            onChange={(event) => {
              setFieldNameInput(event.target.value);
              setFieldNameError(null);
            }}
          />
          <FormControl fullWidth>
            <InputLabel id="field-type-label">Value type</InputLabel>
            <Select
              labelId="field-type-label"
              value={fieldTypeInput}
              label="Value type"
              onChange={(event) =>
                setFieldTypeInput(event.target.value as FieldType)
              }
            >
              {fieldTypeOptions.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
        <Stack gap={1}>
          {placeholders.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {"No {{field}} placeholder found"}
            </Typography>
          )}
          {detectedPlaceholders.map((entry) => (
            <Box
              key={entry.name}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                px: 1,
                py: 0.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                backgroundColor: "background.paper",
              }}
            >
              <Chip
                label={`{{${entry.name}}}`}
                color="primary"
                variant="outlined"
                sx={{ fontFamily: "monospace" }}
              />
              <Chip
                size="small"
                label={entry.type}
                color="default"
                icon={<InfoOutlinedIcon />}
                sx={{ textTransform: "lowercase" }}
              />
            </Box>
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
