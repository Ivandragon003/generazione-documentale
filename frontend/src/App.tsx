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
import { DynamicDocument } from "./components/DynamicDocument";
import { HeaderBar } from "./components/HeaderBar";
import { PdfPreview } from "./components/PdfPreview";
import { TemplateEditor } from "./components/TemplateEditor";
import {
  type ApiTemplateField,
  createTemplate,
  type FieldValue,
  type FieldValueMap,
  getPdfJob,
  getPdfJobs,
  getTemplates,
  type PdfJobDto,
  type TemplateDto,
  triggerPdfGeneration,
  updateTemplate,
} from "./data/api";
import {
  comparePlaceholderSets,
  extractPlaceholders,
  initialFieldValues,
  normalizeFieldDefinitions,
  validateFieldValues,
} from "./utils/template";

const tabLabels = ["Template", "Documento", "PDF"];

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

function getItemSecondary(item: TemplateDto): string {
  if (item.githubPath) return item.githubPath;
  return item.updatedAt
    ? new Date(item.updatedAt).toLocaleDateString("it-IT")
    : "";
}

async function pollJobUntilDone(
  templateId: string,
  jobId: string,
  onUpdate: (job: PdfJobDto) => void,
): Promise<void> {
  const maxAttempts = 24;
  const intervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(intervalMs);
    try {
      const updated = await getPdfJob(templateId, jobId);
      onUpdate(updated);
      if (updated.status === "completed" || updated.status === "failed") {
        return;
      }
    } catch (error) {
      console.warn(
        "Polling job PDF fallito, nuovo tentativo al prossimo tick",
        {
          templateId,
          jobId,
          error,
        },
      );
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
          : "Template GitHub";
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
  const [markdown, setMarkdown] = useState("");
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);
  const [fieldValues, setFieldValues] = useState<FieldValueMap>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const originalPlaceholders = useRef<string[]>([]);
  const pollingAbort = useRef<AbortController | null>(null);

  const hasUnsavedChanges = markdown !== (template?.content ?? "");

  const visibleFields = useMemo(
    () => normalizeFieldDefinitions(markdown, template?.fields ?? []),
    [markdown, template],
  );

  const currentPlaceholders = useMemo(
    () => extractPlaceholders(markdown),
    [markdown],
  );

  const diff = useMemo(
    () =>
      comparePlaceholderSets(originalPlaceholders.current, currentPlaceholders),
    [currentPlaceholders],
  );

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const templateResponse = await withBootRetry(() => getTemplates());
        if (cancelled) return;

        const firstTemplate =
          templateResponse.data.find((item) => item.content?.trim()) ??
          templateResponse.data[0] ??
          null;

        setTemplates(templateResponse.data);

        if (firstTemplate) {
          const fields = normalizeFieldDefinitions(
            firstTemplate.content,
            firstTemplate.fields,
          );
          setTemplate(firstTemplate);
          setMarkdown(firstTemplate.content);
          setFieldValues(initialFieldValues(fields));
          originalPlaceholders.current = extractPlaceholders(
            firstTemplate.content,
          );
          const jobs = await getPdfJobs(firstTemplate.id).catch(() => []);
          if (!cancelled) setPdfJobs(jobs);
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

  const applyTemplate = useCallback((nextTemplate: TemplateDto) => {
    const fields = normalizeFieldDefinitions(
      nextTemplate.content,
      nextTemplate.fields,
    );
    setTemplate(nextTemplate);
    setMarkdown(nextTemplate.content);
    setFieldValues(initialFieldValues(fields));
    setFieldErrors({});
    setPdfJobs([]);
    originalPlaceholders.current = extractPlaceholders(nextTemplate.content);
  }, []);

  const handleSelectTemplate = useCallback(
    (selected: TemplateDto) => {
      applyTemplate(selected);
      void getPdfJobs(selected.id)
        .then(setPdfJobs)
        .catch((error) => {
          setSnack({
            open: true,
            msg: "Impossibile caricare lo storico PDF del template selezionato.",
            severity: "error",
          });
          console.error("Errore caricamento job PDF", error);
        });
    },
    [applyTemplate],
  );

  const handleSaveTemplate = useCallback(async () => {
    if (!markdown.trim()) {
      const msg = "Il contenuto del template e vuoto.";
      setSnack({ open: true, msg, severity: "error" });
      throw new Error(msg);
    }

    setAppStatus("saving");
    try {
      const fields: ApiTemplateField[] = visibleFields.map(
        ({
          name,
          label,
          type,
          required,
          defaultValue,
          placeholder,
          options,
          columns,
        }) => ({
          name,
          label,
          type,
          required,
          defaultValue,
          placeholder,
          options,
          columns,
        }),
      );
      const saved = template
        ? await updateTemplate(template.id, { content: markdown, fields })
        : await createTemplate({
            name: "Nuovo Template",
            content: markdown,
            fields,
          });

      originalPlaceholders.current = extractPlaceholders(saved.content);
      setTemplate(saved);
      setTemplates((current) => [
        saved,
        ...current.filter(
          (item) => item.id !== template?.id && item.id !== saved.id,
        ),
      ]);
      setFieldValues((current) => ({
        ...initialFieldValues(
          normalizeFieldDefinitions(saved.content, saved.fields),
        ),
        ...current,
      }));
      setSnack({ open: true, msg: "Template salvato.", severity: "success" });
      return saved;
    } catch (err) {
      const msg = `Errore salvataggio template: ${String(err)}`;
      setSnack({ open: true, msg, severity: "error" });
      throw err;
    } finally {
      setAppStatus("ready");
    }
  }, [markdown, template, visibleFields]);

  const handleFieldChange = useCallback((key: string, value: FieldValue) => {
    setFieldValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  }, []);

  const handleGeneratePdf = useCallback(async () => {
    let currentTemplate = template;

    if (!currentTemplate) {
      setSnack({
        open: true,
        msg: "Seleziona un template prima di generare il PDF.",
        severity: "error",
      });
      return;
    }

    if (hasUnsavedChanges) {
      try {
        currentTemplate = await handleSaveTemplate();
      } catch {
        return; // handleSaveTemplate already shows a snackbar
      }
    }

    const errors = validateFieldValues(visibleFields, fieldValues);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActiveTab(1);
      setSnack({
        open: true,
        msg: "Completa i campi obbligatori prima di generare il PDF.",
        severity: "error",
      });
      return;
    }

    pollingAbort.current?.abort();
    const abort = new AbortController();
    pollingAbort.current = abort;

    const resolvedTemplateId = currentTemplate.id;

    try {
      const job = await triggerPdfGeneration(resolvedTemplateId, fieldValues);
      setPdfJobs((current) => [
        job,
        ...current.filter((item) => item.id !== job.id),
      ]);
      setSnack({
        open: true,
        msg: "Generazione PDF avviata.",
        severity: "success",
      });

      void pollJobUntilDone(resolvedTemplateId, job.id, (updated) => {
        if (abort.signal.aborted) return;
        setPdfJobs((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (updated.status === "completed") {
          setSnack({
            open: true,
            msg: "PDF generato con successo.",
            severity: "success",
          });
          setActiveTab(2);
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
  }, [
    fieldValues,
    hasUnsavedChanges,
    handleSaveTemplate,
    template,
    visibleFields,
  ]);

  useEffect(() => {
    return () => {
      pollingAbort.current?.abort();
    };
  }, []);

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
            canGeneratePdf={Boolean(template)}
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
                />
              )}

              {activeTab === 1 && (
                <Paper className="preview-sheet">
                  <DynamicDocument
                    markdown={markdown}
                    fields={visibleFields}
                    values={fieldValues}
                    errors={fieldErrors}
                    onChange={handleFieldChange}
                  />
                </Paper>
              )}

              {activeTab === 2 && (
                <PdfPreview
                  markdown={markdown}
                  fields={visibleFields}
                  values={fieldValues}
                  pdfJobs={pdfJobs}
                  templateId={template?.id}
                  documentName={template?.name}
                  templateContentHash={template?.contentHash}
                />
              )}
            </Box>
          </Paper>
        </Box>

        {appStatus === "error" && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Backend non raggiungibile. Assicurati che il server sia in
            esecuzione su <strong>localhost:3000</strong>.
          </Alert>
        )}

        {hasUnsavedChanges && appStatus === "ready" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Hai modifiche non salvate. Salva il template prima di generare il
            PDF.
          </Alert>
        )}

        <Paper className="architecture-note" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            MAC Document Editor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Template GitHub, compilazione documento e generazione PDF via API
            REST.
          </Typography>
        </Paper>
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={() => setSnack((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((current) => ({ ...current, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
