import AddIcon from "@mui/icons-material/Add";
import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import { useState } from "react";
import type { FieldType } from "../data/api";

type Props = {
  markdown: string;
  onChange: (value: string) => void;
};

export function TemplateEditor({ markdown, onChange }: Props) {
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
    </Stack>
  );
}
