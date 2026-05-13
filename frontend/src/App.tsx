import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import {
  Alert,
  AppBar,
  Box,
  Chip,
  CircularProgress,
  Container,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
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
  type ApiTemplateField,
  createTemplate,
  getPdfJob,
  getPdfJobs,
  getTemplates,
  type PdfJobDto,
  type TemplateDto,
  triggerPdfGeneration,
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

const sleep = (ms: number) =>
  new Promise<void>((resolve) => globalThis.setTimeout(resolve, ms));

async function withBootRetry<T>(load: () => Promise<T>): Promise<T> {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await sleep(800);
    }
  }
  throw new Error("Backend non disponibile");
}

function apiFieldFromKey(key: string, markdown: string): ApiTemplateField {
  const regex = new RegExp(`\\{\\{\\s*${key}(?::([a-z]+))?\\s*\\}\\}`, "i");
  const match = markdown.match(regex);
  const type = (match?.[1] as ApiTemplateField["type"]) || "text";
  return { name: key, label: key, type };
}

function fieldFromKey(key: string): TemplateField {
  return { key, label: key, type: "text", placeholder: `Valore per ${key}` };
}

function toTemplateField(f: ApiTemplateField): TemplateField {
  return {
    key: f.name,
    label: f.label ?? f.name,
    type: "text",
    placeholder: `Valore per ${f.name}`,
  };
}

function isUuid(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

function isGithubTemplate(template: TemplateDto | null): boolean {
  return Boolean(template?.id?.startsWith("github:"));
}

function getItemSecondary(item: TemplateDto): string {
  if (item.githubPath) {
    const filename = item.githubPath.split("/").at(-1) ?? "";
    return isUuid(item.id) ? `${filename} (Locale)` : filename;
  }
  return item.content ? item.status : "Contenuto mancante";
}

// ── Polling helper ────────────────────────────────────────────────────────────
// Fa polling su un job PDF finché non è completed o failed (max 2 minuti)
async function pollJobUntilDone(
  templateId: string,
  jobId: string,
  onUpdate: (job: PdfJobDto) => void,
): Promise<void> {
  const MAX_ATTEMPTS = 24; // 24 × 5s = 120s
  const INTERVAL_MS = 5000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await sleep(INTERVAL_MS);
    try {
      const updated = await getPdfJob(templateId, jobId);
      onUpdate(updated);
      if (updated.status === "completed" || updated.status === "failed") {
        return;
      }
    } catch {
      // ignora errori di rete temporanei durante il polling
    }
  }
}

function ProjectStructure({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: {
  readonly templates: TemplateDto[];
  readonly selectedTemplateId: string | null;
  readonly onSelectTemplate: (template: TemplateDto) => void;
}) {
  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, TemplateDto[]>();
    for (const item of templates) {
      const groupName =
        item.category && item.section
          ? `${item.category} / ${item.section}`
          : "Template locali";
      groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
    }
    return Array.from(groups.entries());
  }, [templates]);

  return (
    <Paper className="project-structure">
      <Typography className="structure-title" variant="overline">
        Struttura progetto
      </Typography>
      <Divider />
      {groupedTemplates.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
          Nessun template disponibile
        </Typography>
      ) : (
        groupedTemplates.map(([groupName, items]) => (
          <Box key={groupName}>
            <Stack
              direction="row"
              alignItems="center"
              gap={1}
              className="structure-group"
            >
              <FolderIcon fontSize="small" color="warning" />
              <Typography variant="subtitle2" noWrap>
                {groupName}
              </Typography>
              <Chip size="small" label={items.length} />
            </Stack>
            <List dense disablePadding>
              {items.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={item.id === selectedTemplateId}
                  onClick={() => onSelectTemplate(item)}
                  className="template-list-item"
                >
                  <DescriptionIcon fontSize="small" color="disabled" />
                  <ListItemText
                    primary={item.name}
                    secondary={getItemSecondary(item)}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: { noWrap: true },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))
      )}
    </Paper>
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
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // templateId UUID reale da usare per le API PDF (potrebbe essere diverso da template.id)
  const [pdfTemplateId, setPdfTemplateId] = useState<string | null>(null);

  const originalPlaceholders = useRef<string[]>([]);
  const pollingAbort = useRef<AbortController | null>(null);

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const tmplRes = await withBootRetry(() => getTemplates());
        if (cancelled) return;

        const firstTemplate =
          tmplRes.data.find((t) => isUuid(t.id) && t.content?.trim()) ??
          tmplRes.data.find((t) => isUuid(t.id)) ??
          tmplRes.data[0] ??
          null;

        setTemplates(tmplRes.data);

        if (firstTemplate) {
          setTemplate(firstTemplate);
          const content = firstTemplate.content?.trim() ?? "";
          setMarkdown(content);
          originalPlaceholders.current = extractPlaceholders(content);

          if (isUuid(firstTemplate.id)) {
            setPdfTemplateId(firstTemplate.id);
            const jobs = await getPdfJobs(firstTemplate.id).catch(() => []);
            if (!cancelled) setPdfJobs(jobs);
          }
        }

        setAppStatus("ready");
      } catch {
        if (!cancelled) {
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

  const [markdown, setMarkdown] = useState("");

  // ── Import template ───────────────────────────────────────────────────
  const handleTemplateImported = useCallback(
    (importedTemplate: TemplateDto) => {
      setTemplates((current) => [
        importedTemplate,
        ...current.filter((item) => item.id !== importedTemplate.id),
      ]);
      setTemplate(importedTemplate);
      setMarkdown(importedTemplate.content);
      originalPlaceholders.current = extractPlaceholders(
        importedTemplate.content,
      );
      setPdfTemplateId(
        isUuid(importedTemplate.id) ? importedTemplate.id : null,
      );
      setPdfJobs([]);
      setFieldValues({});
      setSnack({
        open: true,
        msg: `Template "${importedTemplate.name}" importato.`,
        severity: "success",
      });
    },
    [],
  );

  const handleSelectTemplate = useCallback((selected: TemplateDto) => {
    setTemplate(selected);
    setMarkdown(selected.content);
    originalPlaceholders.current = extractPlaceholders(selected.content);
    setFieldValues({});
    setPdfJobs([]);

    if (isUuid(selected.id)) {
      setPdfTemplateId(selected.id);
      void getPdfJobs(selected.id)
        .then(setPdfJobs)
        .catch(() => {});
    } else {
      // Template GitHub non ancora salvato localmente — nessun UUID disponibile
      setPdfTemplateId(null);
    }
  }, []);

  // ── Salva Template ────────────────────────────────────────────────────────
  const handleSaveTemplate = useCallback(async () => {
    if (!markdown.trim()) {
      setSnack({
        open: true,
        msg: "Il contenuto del template è vuoto. Aggiungi del testo prima di salvare.",
        severity: "error",
      });
      return;
    }

    setAppStatus("saving");
    try {
      const currentPlaceholders = extractPlaceholders(markdown);

      const existingLocal = isGithubTemplate(template)
        ? templates.find(
            (t) =>
              t.id !== template?.id && t.githubPath === template?.id.slice(7),
          )
        : null;

      if (template && isUuid(template.id) && !isGithubTemplate(template)) {
        const updated = await updateTemplate(template.id, {
          content: markdown,
          fields: currentPlaceholders.map((k) => apiFieldFromKey(k, markdown)),
        });
        originalPlaceholders.current = extractPlaceholders(updated.content);
        setTemplate(updated);
        setPdfTemplateId(updated.id);
        setTemplates((current) =>
          current.map((t) => (t.id === updated.id ? updated : t)),
        );
        setSnack({ open: true, msg: "Template salvato.", severity: "success" });
      } else if (existingLocal) {
        const updated = await updateTemplate(existingLocal.id, {
          content: markdown,
          fields: currentPlaceholders.map((k) => apiFieldFromKey(k, markdown)),
        });
        originalPlaceholders.current = extractPlaceholders(updated.content);
        setTemplate(updated);
        setPdfTemplateId(updated.id);
        setTemplates((current) =>
          current.map((t) => (t.id === updated.id ? updated : t)),
        );
        setSnack({
          open: true,
          msg: "Template locale aggiornato.",
          severity: "success",
        });
      } else {
        const newTmpl = await createTemplate({
          name: template?.name ?? "Nuovo Template",
          content: markdown,
          fields: currentPlaceholders.map((k) => apiFieldFromKey(k, markdown)),
          path: isGithubTemplate(template) ? template?.id : undefined,
        });
        if (!isUuid(newTmpl.id))
          throw new Error(
            `Template creato senza ID UUID valido: ${newTmpl.id}`,
          );
        setTemplate(newTmpl);
        setPdfTemplateId(newTmpl.id);
        setTemplates((current) => [
          newTmpl,
          ...current.filter((item) => item.id !== newTmpl.id),
        ]);
        originalPlaceholders.current = extractPlaceholders(newTmpl.content);
        setPdfJobs([]);
        setSnack({
          open: true,
          msg: "Template locale creato e salvato.",
          severity: "success",
        });
      }
    } catch (err) {
      setSnack({
        open: true,
        msg: `Errore salvataggio template: ${String(err)}`,
        severity: "error",
      });
    } finally {
      setAppStatus("ready");
    }
  }, [markdown, template, templates]);

  // ── Genera PDF ────────────────────────────────────────────────────────────
  const handleGeneratePdf = useCallback(async () => {
    // Serve UUID reale del template
    const targetId = pdfTemplateId;
    if (!targetId) {
      setSnack({
        open: true,
        msg: "Salva prima il template come copia locale per abilitare la generazione PDF.",
        severity: "error",
      });
      return;
    }

    // Cancella eventuale polling precedente
    pollingAbort.current?.abort();
    const abort = new AbortController();
    pollingAbort.current = abort;

    try {
      const job = await triggerPdfGeneration(targetId, fieldValues);
      // Aggiunge il job in cima alla lista
      setPdfJobs((prev) => [job, ...prev.filter((j) => j.id !== job.id)]);
      setSnack({
        open: true,
        msg: "Generazione PDF avviata — attendi...",
        severity: "success",
      });

      // Avvia polling in background
      void pollJobUntilDone(targetId, job.id, (updated) => {
        if (abort.signal.aborted) return;
        setPdfJobs((prev) =>
          prev.map((j) => (j.id === updated.id ? updated : j)),
        );
        if (updated.status === "completed") {
          setSnack({
            open: true,
            msg: "PDF generato con successo!",
            severity: "success",
          });
          setActiveTab(2); // passa ad Anteprima PDF
        }
        if (updated.status === "failed") {
          setSnack({
            open: true,
            msg: `Generazione PDF fallita: ${updated.errorMessage ?? "errore sconosciuto"}`,
            severity: "error",
          });
        }
      });
    } catch (err) {
      setSnack({
        open: true,
        msg: `Errore PDF: ${String(err)}`,
        severity: "error",
      });
    }
  }, [pdfTemplateId, fieldValues]);

  // ── Cleanup polling su unmount ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      pollingAbort.current?.abort();
    };
  }, []);

  // ── Campi ──────────────────────────────────────────────────────────────────
  const handleFieldChange = useCallback((key: string, value: string) => {
    setFieldValues((cur) => ({ ...cur, [key]: value }));
  }, []);

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
    const tmplFields: TemplateField[] = (template?.fields ?? [])
      .filter((f) => keys.has(f.name))
      .map(toTemplateField);
    const extra: TemplateField[] = currentPlaceholders
      .filter((k) => !tmplFields.some((f) => f.key === k))
      .map(fieldFromKey);
    return [...tmplFields, ...extra];
  }, [currentPlaceholders, template]);

  const rendered = useMemo(
    () => renderMarkdown(markdown, fieldValues),
    [markdown, fieldValues],
  );

  // canGeneratePdf: serve UUID reale (salvato localmente)
  const canGeneratePdf = Boolean(pdfTemplateId);

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
            template={template}
            isSaving={appStatus === "saving"}
            onSave={handleSaveTemplate}
            onGeneratePdf={handleGeneratePdf}
            pdfJobs={pdfJobs}
            canGeneratePdf={canGeneratePdf}
            showSaveTemplate={activeTab === 0}
          />
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Box className="app-layout">
          <ProjectStructure
            templates={templates}
            selectedTemplateId={template?.id ?? null}
            onSelectTemplate={handleSelectTemplate}
          />

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
                  onChange={handleFieldChange}
                />
              )}

              {activeTab === 2 && (
                <PdfPreview
                  content={rendered}
                  pdfJobs={pdfJobs}
                  templateId={pdfTemplateId ?? undefined}
                  documentName={template?.name}
                />
              )}
            </Box>
          </Paper>
        </Box>

        {appStatus === "error" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Backend non raggiungibile — assicurati che il server sia in
            esecuzione su <strong>localhost:3000</strong>.
          </Alert>
        )}

        {isGithubTemplate(template) && !pdfTemplateId && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Questo è un template GitHub. Clicca <strong>Salva Template</strong>{" "}
            per creare una copia locale e abilitare la generazione PDF.
          </Alert>
        )}

        <Paper className="architecture-note" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            MAC Document Editor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Editor collegato al backend NestJS. Template e PDF jobs vengono
            caricati e salvati via API REST.
          </Typography>
        </Paper>
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
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
