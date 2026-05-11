import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Alert,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useRef } from "react";
import type { TemplateDto } from "../data/api";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:3000") + "/api";

type Props = {
  markdown: string;
  onChange: (value: string) => void;
  placeholders: string[];
  added: string[];
  removed: string[];
  onTemplateImported?: (template: TemplateDto) => void;
};

export function TemplateEditor({
  markdown,
  onChange,
  placeholders,
  added,
  removed,
  onTemplateImported,
}: Props) {
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Importa template via API (multipart) ─────────────────────────────────
  async function handleImportFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name.replace(/\.md$/i, ""));

    try {
      const res = await fetch(`${BASE}/templates/import`, {
        method: "POST",
        headers: { "x-user": "frontend" },
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const tmpl = (await res.json()) as TemplateDto;
      onChange(tmpl.content);
      onTemplateImported?.(tmpl); // passa il TemplateDto completo con id UUID
    } catch (err) {
      alert(`Errore importazione: ${String(err)}`);
    }
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (
      file.name.endsWith(".md") ||
      file.type === "text/plain" ||
      file.type === "text/markdown"
    ) {
      void handleImportFile(file);
    } else {
      alert("Formato non supportato. Carica un file .md");
    }
  }

  // ── Crea campo: inserisce {{campo_N}} nel testo ───────────────────────────
  function handleCreateField() {
    // Usa la lunghezza dei placeholder già presenti per generare un nome unico
    const fieldName = `campo_${placeholders.length + 1}`;
    // Inserisce su nuova riga in fondo (o all'inizio se l'editor è vuoto)
    const separator = markdown.length > 0 ? "\n" : "";
    onChange(`${markdown}${separator}{{${fieldName}}}`);
  }

  return (
    <Stack gap={2}>
      {/* file input nascosto — solo .md */}
      <input
        ref={importInputRef}
        type="file"
        accept=".md,text/markdown,text/plain"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />

      <Paper className="panel-shell">
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => importInputRef.current?.click()}
            >
              Importa template
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Trascina un file .md per importarlo
          </Typography>
        </Stack>
        <Divider sx={{ my: 2 }} />
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
            Crea campo
          </Button>
        </Stack>
      </Paper>

      <Paper
        className="editor-paper"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <TextField
          multiline
          minRows={22}
          fullWidth
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          variant="standard"
          InputProps={{ disableUnderline: true, className: "editor-input" }}
          placeholder="Scrivi il tuo template Markdown qui, oppure trascina un file .md"
        />
      </Paper>

      <Paper className="panel-shell">
        <Typography variant="subtitle1" gutterBottom>
          Placeholder rilevati
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {placeholders.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {"Nessun placeholder {{campo}} trovato"}
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
            Struttura cambiata — nuovi:{" "}
            <strong>{added.join(", ") || "nessuno"}</strong> · rimossi:{" "}
            <strong>{removed.join(", ") || "nessuno"}</strong>. Al salvataggio
            verrà creato un nuovo template.
          </Alert>
        )}
      </Paper>
    </Stack>
  );
}
