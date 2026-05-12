import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { FieldsPanel } from "./components/FieldsPanel";
import { HeaderBar } from "./components/HeaderBar";
import { PdfPreview } from "./components/PdfPreview";
import { TemplateEditor } from "./components/TemplateEditor";
import type { TemplateField } from "./data/mock";

const BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:3000") + "/api";

// ─── Types (allineati al backend) ────────────────────────────────────────────

export type DocumentStatus = "draft" | "generated" | "published" | "archived";

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  fields: ApiTemplateField[];
  status: "draft" | "published";
  sectionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentDto = {
  id: string;
  name: string;
  templateId: string | null;
  content: string;
  fieldValues: Record<string, string | number | boolean | null>;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type PdfJobDto = {
  id: string;
  documentId: string;
  status: "queued" | "running" | "completed" | "failed";
  filename: string | null;
  unresolvedFields: string[];
  errorMessage: string | null;
  requestedBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type ApiTemplateField = {
  name: string;
  label?: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "boolean"
    | "email"
    | "url"
    | "tel"
    | "select"
    | "currency";
  required?: boolean;
  defaultValue?: string;
};

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-user": "frontend",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[${res.status}] ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function getTemplates() {
  return apiFetch<{ data: TemplateDto[]; total: number }>(`${BASE}/templates`);
}
export function getDocuments() {
  return apiFetch<{ data: DocumentDto[]; total: number }>(`${BASE}/documents`);
}
export function createDocument(payload: { name: string; templateId: string }) {
  return apiFetch<DocumentDto>(`${BASE}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
export function updateDocument(
  id: string,
  payload: { name?: string; content?: string; fieldValues?: Record<string, string | number | boolean | null> },
) {
  return apiFetch<DocumentDto>(`${BASE}/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
export function triggerPdfGeneration(documentId: string) {
  return apiFetch<PdfJobDto>(`${BASE}/documents/${documentId}/pdf`, { method: "POST" });
}
export function getPdfJobs(documentId: string) {
  return apiFetch<PdfJobDto[]>(`${BASE}/documents/${documentId}/pdf/jobs`);
}
export function getPdfDownloadUrl(documentId: string, jobId: string) {
  return `${BASE}/documents/${documentId}/pdf/jobs/${jobId}/download`;
}
export function getLatestPdfUrl(documentId: string) {
  return `${BASE}/documents/${documentId}/pdf/latest`;
}
export function deleteTemplate(id: string) {
  return apiFetch<void>(`${BASE}/templates/${id}`, { method: "DELETE" });
}
export function deleteDocument(id: string) {
  return apiFetch<void>(`${BASE}/documents/${id}`, { method: "DELETE" });
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function extractPlaceholders(md: string): string[] {
  const matches = md.matchAll(/\{\{([^}]+)\}\}/g);
  return [...new Set([...matches].map((m) => m[1].trim()))];
}

function apiFieldsToTemplateFields(fields: ApiTemplateField[]): TemplateField[] {
  return fields.map((f) => ({
    key: f.name,
    label: f.label ?? f.name,
    type:
      f.type === "textarea"
        ? "longText"
        : f.type === "currency"
        ? "currency"
        : f.type === "date"
        ? "date"
        : "text",
    placeholder: f.defaultValue ?? "",
  }));
}

const DRAWER_WIDTH = 260;

// ─── Root Component ───────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  // ── stato liste
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // ── documento/template selezionato
  const [activeDocument, setActiveDocument] = useState<DocumentDto | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateDto | null>(null);

  // ── editor
  const [markdown, setMarkdown] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [added, setAdded] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);

  // ── pdf
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);

  // ── UI
  const [tab, setTab] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [snack, setSnack] = useState<{ msg: string; severity: "success" | "error" } | null>(null);

  // ── dialogo nuovo documento
  const [newDocDialog, setNewDocDialog] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocTemplateId, setNewDocTemplateId] = useState("");

  // ── caricamento iniziale liste
  useEffect(() => {
    Promise.all([getDocuments(), getTemplates()])
      .then(([docs, tpls]) => {
        setDocuments(docs.data);
        setTemplates(tpls.data);
        if (docs.data.length > 0) selectDocument(docs.data[0], tpls.data);
      })
      .catch(() => setSnack({ msg: "Errore caricamento dati", severity: "error" }))
      .finally(() => setLoadingList(false));
  }, []);

  // ── seleziona documento
  const selectDocument = useCallback(
    (doc: DocumentDto, tplList: TemplateDto[] = templates) => {
      setActiveDocument(doc);
      const tpl = tplList.find((t) => t.id === doc.templateId) ?? null;
      setActiveTemplate(tpl);
      setMarkdown(doc.content ?? "");
      const currentPlaceholders = extractPlaceholders(doc.content ?? "");
      setPlaceholders(currentPlaceholders);
      setAdded([]);
      setRemoved([]);
      // Inizializza fieldValues dai valori salvati + placeholder esistenti
      const saved = doc.fieldValues as Record<string, string>;
      const init: Record<string, string> = {};
      for (const p of currentPlaceholders) init[p] = saved[p] ?? "";
      setFieldValues(init);
      // Carica pdf jobs
      getPdfJobs(doc.id)
        .then(setPdfJobs)
        .catch(() => setPdfJobs([]));
    },
    [templates],
  );

  // ── aggiorna placeholder al cambio markdown
  const handleMarkdownChange = (value: string) => {
    setMarkdown(value);
    const newP = extractPlaceholders(value);
    const oldP = placeholders;
    setAdded(newP.filter((p) => !oldP.includes(p)));
    setRemoved(oldP.filter((p) => !newP.includes(p)));
    setPlaceholders(newP);
  };

  // ── salva documento
  const handleSave = async () => {
    if (!activeDocument) return;
    setIsSaving(true);
    try {
      const updated = await updateDocument(activeDocument.id, {
        content: markdown,
        fieldValues: fieldValues as Record<string, string | number | boolean | null>,
      });
      setActiveDocument(updated);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setAdded([]);
      setRemoved([]);
      setSnack({ msg: "Documento salvato", severity: "success" });
    } catch (err) {
      setSnack({ msg: `Errore salvataggio: ${String(err)}`, severity: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  // ── genera PDF
  const handleGeneratePdf = async () => {
    if (!activeDocument) return;
    try {
      await triggerPdfGeneration(activeDocument.id);
      setSnack({ msg: "Generazione PDF avviata", severity: "success" });
      setTimeout(() => {
        if (activeDocument)
          getPdfJobs(activeDocument.id)
            .then(setPdfJobs)
            .catch(() => {});
      }, 2000);
    } catch (err) {
      setSnack({ msg: `Errore PDF: ${String(err)}`, severity: "error" });
    }
  };

  // ── crea nuovo documento
  const handleCreateDocument = async () => {
    if (!newDocName.trim() || !newDocTemplateId) return;
    try {
      const doc = await createDocument({ name: newDocName.trim(), templateId: newDocTemplateId });
      const updatedDocs = [doc, ...documents];
      setDocuments(updatedDocs);
      selectDocument(doc, templates);
      setNewDocDialog(false);
      setNewDocName("");
      setNewDocTemplateId("");
      setSnack({ msg: "Documento creato", severity: "success" });
    } catch (err) {
      setSnack({ msg: `Errore creazione: ${String(err)}`, severity: "error" });
    }
  };

  // ── fields dal template attivo (per FieldsPanel)
  const templateFields: TemplateField[] =
    activeTemplate ? apiFieldsToTemplateFields(activeTemplate.fields) : [];

  // ── contenuto preview con placeholder sostituiti
  const previewContent = placeholders.reduce(
    (acc, key) => acc.replaceAll(`{{${key}}}`, fieldValues[key] ?? `{{${key}}}`),
    markdown,
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <CssBaseline />

      {/* ── Sidebar documenti ───────────────────────────────────────────── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Stack sx={{ p: 2, pt: 3 }} gap={1}>
          <Typography variant="h6" fontWeight={800}>
            Documenti
          </Typography>
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={() => setNewDocDialog(true)}
            disabled={templates.length === 0}
          >
            + Nuovo documento
          </Button>
        </Stack>
        <Divider />
        {loadingList ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense disablePadding>
            {documents.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Nessun documento. Creane uno.
              </Typography>
            )}
            {documents.map((doc) => (
              <ListItemButton
                key={doc.id}
                selected={activeDocument?.id === doc.id}
                onClick={() => selectDocument(doc)}
              >
                <ListItemText
                  primary={doc.name}
                  secondary={doc.status}
                  primaryTypographyProps={{ noWrap: true, fontWeight: activeDocument?.id === doc.id ? 700 : 400 }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Drawer>

      {/* ── Area principale ─────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <HeaderBar
          document={activeDocument}
          template={activeTemplate}
          isSaving={isSaving}
          onSave={handleSave}
          onGeneratePdf={handleGeneratePdf}
          pdfJobs={pdfJobs}
        />

        {!activeDocument ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Stack alignItems="center" gap={2}>
              <Typography variant="h5" color="text.secondary">
                Nessun documento selezionato
              </Typography>
              <Button
                variant="contained"
                onClick={() => setNewDocDialog(true)}
                disabled={templates.length === 0}
              >
                + Crea il tuo primo documento
              </Button>
              {templates.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Carica prima un template dal backend (Swagger)
                </Typography>
              )}
            </Stack>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v as number)} sx={{ mb: 3 }}>
              <Tab label="Editor template" />
              <Tab label="Compila campi" />
              <Tab label="Anteprima PDF" />
            </Tabs>

            {tab === 0 && (
              <TemplateEditor
                markdown={markdown}
                onChange={handleMarkdownChange}
                placeholders={placeholders}
                added={added}
                removed={removed}
                onTemplateImported={(tpl) => {
                  setActiveTemplate(tpl);
                  setMarkdown(tpl.content);
                  handleMarkdownChange(tpl.content);
                }}
              />
            )}

            {tab === 1 && (
              <FieldsPanel
                fields={
                  templateFields.length > 0
                    ? templateFields
                    : placeholders.map((p) => ({
                        key: p,
                        label: p,
                        type: "text" as const,
                        placeholder: `Valore per {{${p}}}`,
                      }))
                }
                values={fieldValues}
                onChange={(key, value) =>
                  setFieldValues((prev) => ({ ...prev, [key]: value }))
                }
              />
            )}

            {tab === 2 && (
              <PdfPreview
                content={previewContent}
                pdfJobs={pdfJobs}
                documentId={activeDocument.id}
              />
            )}
          </Box>
        )}
      </Box>

      {/* ── Dialog nuovo documento ──────────────────────────────────────── */}
      <Dialog open={newDocDialog} onClose={() => setNewDocDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nuovo documento</DialogTitle>
        <DialogContent>
          <Stack gap={2} sx={{ pt: 1 }}>
            <TextField
              label="Nome documento"
              fullWidth
              value={newDocName}
              onChange={(e) => setNewDocName(e.target.value)}
              autoFocus
            />
            <TextField
              label="Template"
              fullWidth
              select
              SelectProps={{ native: true }}
              value={newDocTemplateId}
              onChange={(e) => setNewDocTemplateId(e.target.value)}
            >
              <option value="">— seleziona —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDocDialog(false)}>Annulla</Button>
          <Button
            variant="contained"
            onClick={() => { void handleCreateDocument(); }}
            disabled={!newDocName.trim() || !newDocTemplateId}
          >
            Crea
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Snackbar feedback ───────────────────────────────────────────── */}
      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack?.severity ?? "success"} onClose={() => setSnack(null)}>
          {snack?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
