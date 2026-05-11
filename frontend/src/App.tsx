import {
  Alert,
  AppBar,
  Box,
  CircularProgress,
  Container,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FieldsPanel } from "./components/FieldsPanel";
import { HeaderBar } from "./components/HeaderBar";
import { PdfPreview } from "./components/PdfPreview";
import { TemplateEditor } from "./components/TemplateEditor";
import {
  createDocument,
  createTemplate,
  type DocumentDto,
  getDocuments,
  getPdfJobs,
  getTemplates,
  type PdfJobDto,
  type TemplateDto,
  triggerPdfGeneration,
  updateDocument,
  updateTemplate,
} from "./data/api";
import type { TemplateField } from "./data/mock";
import {
  comparePlaceholderSets,
  extractPlaceholders,
  renderMarkdown,
} from "./utils/template";

const tabLabels = ["Template", "Campi", "Anteprima PDF"];

type AppStatus = "loading" | "ready" | "saving" | "error";

function fieldFromKey(key: string): TemplateField {
  return { key, label: key, type: "text", placeholder: `Valore per ${key}` };
}

/** Controlla se una stringa è un UUID v1-v5 valido */
function isUuid(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [snack, setSnack] = useState<{
    open: boolean;
    msg: string;
    severity: "success" | "error";
  }>({ open: false, msg: "", severity: "success" });

  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [document, setDocument] = useState<DocumentDto | null>(null);
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);

  const [markdown, setMarkdown] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const originalPlaceholders = useRef<string[]>([]);

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [tmplRes, docRes] = await Promise.all([
          getTemplates(),
          getDocuments(),
        ]);
        if (cancelled) return;

        const firstTemplate = tmplRes.data[0] ?? null;
        const firstDocument = docRes.data[0] ?? null;

        if (firstTemplate) {
          setTemplate(firstTemplate);
          setMarkdown(firstTemplate.content);
          originalPlaceholders.current = extractPlaceholders(
            firstTemplate.content,
          );
        }

        if (firstDocument) {
          setDocument(firstDocument);
          // fieldValues è già camelCase dal backend
          const fv: Record<string, string> = {};
          for (const [k, v] of Object.entries(
            firstDocument.fieldValues ?? {},
          )) {
            fv[k] = v != null ? String(v) : "";
          }
          setFieldValues(fv);

          const jobs = await getPdfJobs(firstDocument.id);
          if (!cancelled) setPdfJobs(jobs);
        }

        setAppStatus("ready");
      } catch (err) {
        if (!cancelled) {
          console.error("[boot]", err);
          setAppStatus("error");
          setSnack({
            open: true,
            msg: "Impossibile connettersi al backend.",
            severity: "error",
          });
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Callback da TemplateEditor quando viene importato un template via API ──
  const handleTemplateImported = useCallback(
    (importedTemplate: TemplateDto) => {
      setTemplate(importedTemplate);
      setMarkdown(importedTemplate.content);
      originalPlaceholders.current = extractPlaceholders(
        importedTemplate.content,
      );
      setSnack({
        open: true,
        msg: `Template "${importedTemplate.name}" importato.`,
        severity: "success",
      });
    },
    [],
  );

  // ── Salva ─────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setAppStatus("saving");
    try {
      const currentPlaceholders = extractPlaceholders(markdown);
      const diff = comparePlaceholderSets(
        originalPlaceholders.current,
        currentPlaceholders,
      );
      const structureChanged = diff.added.length > 0 || diff.removed.length > 0;

      if (structureChanged) {
        // Struttura cambiata → nuovo template + nuovo documento
        const newTmpl = await createTemplate({
          name: (template?.name ?? "Template") + " (rev)",
          content: markdown,
          fields: currentPlaceholders.map(fieldFromKey),
        });
        setTemplate(newTmpl);
        originalPlaceholders.current = extractPlaceholders(newTmpl.content);

        const newDoc = await createDocument({
          name: document?.name ?? "Documento",
          templateId: newTmpl.id,
        });
        const saved = await updateDocument(newDoc.id, {
          fieldValues: { ...fieldValues },
        });
        setDocument(saved);
        setSnack({
          open: true,
          msg: "Struttura cambiata: nuovo template e documento creati.",
          severity: "success",
        });
      } else if (document) {
        // Stessa struttura, documento già esistente → aggiorna solo fieldValues
        const saved = await updateDocument(document.id, {
          fieldValues: { ...fieldValues },
        });
        setDocument(saved);
        setSnack({
          open: true,
          msg: "Documento salvato.",
          severity: "success",
        });
      } else {
        // Nessun documento in DB → crea template (se serve) + crea documento
        let activeTmpl: TemplateDto;
        if (template && isUuid(template.id)) {
          // Template UUID reale già in DB → aggiornalo
          activeTmpl = await updateTemplate(template.id, { content: markdown });
        } else {
          // Nessun template o ID mock → crea nuovo
          activeTmpl = await createTemplate({
            name: template?.name ?? "Nuovo Template",
            content: markdown,
            fields: currentPlaceholders.map(fieldFromKey),
          });
        }
        setTemplate(activeTmpl);
        originalPlaceholders.current = extractPlaceholders(activeTmpl.content);

        // activeTmpl.id è sempre UUID reale (dalla risposta API)
        const newDoc = await createDocument({
          name: "Nuovo Documento",
          templateId: activeTmpl.id,
        });
        setDocument(newDoc);
        setSnack({
          open: true,
          msg: "Template e documento creati.",
          severity: "success",
        });
      }
    } catch (err) {
      console.error("[save]", err);
      setSnack({
        open: true,
        msg: `Errore salvataggio: ${String(err)}`,
        severity: "error",
      });
    } finally {
      setAppStatus("ready");
    }
  }, [markdown, fieldValues, template, document]);

  // ── Genera PDF ────────────────────────────────────────────────────────────
  const handleGeneratePdf = useCallback(async () => {
    if (!document) {
      setSnack({
        open: true,
        msg: "Salva prima il documento.",
        severity: "error",
      });
      return;
    }
    try {
      const job = await triggerPdfGeneration(document.id);
      setPdfJobs((prev) => [job, ...prev]);
      setSnack({
        open: true,
        msg: "Generazione PDF avviata.",
        severity: "success",
      });
    } catch (err) {
      setSnack({
        open: true,
        msg: `Errore PDF: ${String(err)}`,
        severity: "error",
      });
    }
  }, [document]);

  // ── Derivati ──────────────────────────────────────────────────────────────
  const currentPlaceholders = useMemo(
    () => extractPlaceholders(markdown),
    [markdown],
  );

  const diff = useMemo(
    () =>
      comparePlaceholderSets(originalPlaceholders.current, currentPlaceholders),
    [currentPlaceholders],
  );

  const visibleFields = useMemo((): TemplateField[] => {
    const keys = new Set(currentPlaceholders);
    const tmplFields: TemplateField[] = (
      (template?.fields as TemplateField[]) ?? []
    ).filter((f) => keys.has(f.key));
    const extra: TemplateField[] = currentPlaceholders
      .filter((k) => !tmplFields.some((f) => f.key === k))
      .map(fieldFromKey);
    return [...tmplFields, ...extra];
  }, [currentPlaceholders, template]);

  const rendered = useMemo(
    () => renderMarkdown(markdown, fieldValues),
    [markdown, fieldValues],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (appStatus === "loading") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{ minHeight: "100vh", backgroundColor: "background.default", pb: 6 }}
    >
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        className="top-appbar"
      >
        <Container maxWidth="xl">
          <HeaderBar
            document={document}
            template={template}
            isSaving={appStatus === "saving"}
            onSave={handleSave}
            onGeneratePdf={handleGeneratePdf}
            pdfJobs={pdfJobs}
          />
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Paper className="workspace-shell">
          <Tabs
            value={activeTab}
            onChange={(_, value: number) => setActiveTab(value)}
          >
            {tabLabels.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>

          <Box className="workspace-body">
            {activeTab === 0 && (
              <TemplateEditor
                markdown={markdown}
                onChange={setMarkdown}
                placeholders={currentPlaceholders}
                added={diff.added}
                removed={diff.removed}
                onTemplateImported={handleTemplateImported}
              />
            )}

            {activeTab === 1 && (
              <FieldsPanel
                fields={visibleFields}
                values={fieldValues}
                onChange={(key, value) =>
                  setFieldValues((cur) => ({ ...cur, [key]: value }))
                }
              />
            )}

            {activeTab === 2 && (
              <PdfPreview
                content={rendered}
                pdfJobs={pdfJobs}
                documentId={document?.id}
              />
            )}
          </Box>
        </Paper>

        {appStatus === "error" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Backend non raggiungibile — assicurati che il server sia in
            esecuzione su <strong>localhost:3000</strong>.
          </Alert>
        )}

        <Paper className="architecture-note" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            MAC Document Editor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Editor collegato al backend NestJS. Template e documenti vengono
            caricati e salvati via API REST.
          </Typography>
        </Paper>
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
