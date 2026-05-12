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

/** Crea un ApiTemplateField (per il backend) da una chiave placeholder */
function apiFieldFromKey(key: string): ApiTemplateField {
  return { name: key, label: key, type: "text" };
}

/** Crea un TemplateField (per FieldsPanel) da una chiave placeholder */
function fieldFromKey(key: string): TemplateField {
  return { key, label: key, type: "text", placeholder: `Valore per ${key}` };
}

/** Converte ApiTemplateField → TemplateField per la UI */
function toTemplateField(f: ApiTemplateField): TemplateField {
  return {
    key: f.name,
    label: f.label ?? f.name,
    type: "text",
    placeholder: `Valore per ${f.name}`,
  };
}

/**
 * Controlla se una stringa è un UUID v1-v5 valido.
 * Gli id che iniziano con "github:" NON sono UUID e vanno trattati diversamente.
 */
function isUuid(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s,
  );
}

/**
 * Un template da GitHub ha id = "github:path/to/file.md" — non è un UUID.
 * Per usarlo come templateId nel backend occorre prima crearne uno locale.
 */
function isGithubTemplate(template: TemplateDto | null): boolean {
  return Boolean(template?.id && template.id.startsWith("github:"));
}

/** Ricava il secondary text per un template item */
function getItemSecondary(item: TemplateDto): string {
  if (item.githubPath) {
    return item.githubPath.split("/").at(-1) ?? "";
  }
  return item.content ? item.status : "Contenuto mancante";
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
  const [document, setDocument] = useState<DocumentDto | null>(null);
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);

  const [markdown, setMarkdown] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const originalPlaceholders = useRef<string[]>([]);

  // ── Boot ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let bootHadError = false;
      try {
        const tmplRes = await withBootRetry(() => getTemplates());
        if (cancelled) return;

        // Preferisci template con UUID valido come primo selezionato
        const firstTemplate =
          tmplRes.data.find((t) => isUuid(t.id)) ?? tmplRes.data[0] ?? null;

        setTemplates(tmplRes.data);

        if (firstTemplate) {
          setTemplate(firstTemplate);
          setMarkdown(firstTemplate.content);
          originalPlaceholders.current = extractPlaceholders(
            firstTemplate.content,
          );
        }

        const docRes = await getDocuments().catch(() => {
          bootHadError = true;
          return { data: [], total: 0 };
        });
        if (cancelled) return;

        await initializeDocument(docRes.data[0], cancelled, (err) => {
          bootHadError = bootHadError || err;
        });

        setAppStatus("ready");
        if (bootHadError) {
          setSnack({
            open: true,
            msg: "Template caricati. Alcuni dati documento/PDF non sono disponibili.",
            severity: "error",
          });
        }
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

    async function initializeDocument(
      doc: DocumentDto | undefined,
      cancelled: boolean,
      onError: (error: boolean) => void,
    ) {
      const firstDocument = doc ?? null;

      if (firstDocument) {
        setDocument(firstDocument);
        const fv: Record<string, string> = {};
        for (const [k, v] of Object.entries(firstDocument.fieldValues ?? {})) {
          fv[k] = v !== null && v !== undefined ? String(v) : "";
        }
        setFieldValues(fv);

        const jobs = await getPdfJobs(firstDocument.id).catch(() => {
          onError(true);
          return [];
        });
        if (!cancelled) {
          setPdfJobs(jobs);
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
      setTemplates((current) => [
        importedTemplate,
        ...current.filter((item) => item.id !== importedTemplate.id),
      ]);
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

  const handleSelectTemplate = useCallback((selected: TemplateDto) => {
    setTemplate(selected);
    setMarkdown(selected.content);
    setDocument((current) =>
      current?.templateId === selected.id ? current : null,
    );
    originalPlaceholders.current = extractPlaceholders(selected.content);
    setFieldValues({});
    setPdfJobs([]);
  }, []);

  /**
   * Garantisce che esista un template locale con UUID valido.
   * Se il template corrente è da GitHub (id = "github:..."), ne crea una copia locale.
   */
  const ensureLocalTemplate = useCallback(
    async (currentMarkdown: string): Promise<TemplateDto> => {
      if (template && isUuid(template.id) && !isGithubTemplate(template)) {
        return template;
      }
      // Template da GitHub o senza id valido → crea copia locale
      const newTmpl = await createTemplate({
        name: template?.name ?? "Nuovo Template",
        content: currentMarkdown,
        fields: extractPlaceholders(currentMarkdown).map(apiFieldFromKey),
      });
      if (!isUuid(newTmpl.id)) {
        throw new Error(`Template creato senza ID UUID valido: ${newTmpl.id}`);
      }
      setTemplate(newTmpl);
      setTemplates((current) => [
        newTmpl,
        ...current.filter((item) => item.id !== newTmpl.id),
      ]);
      originalPlaceholders.current = extractPlaceholders(newTmpl.content);
      return newTmpl;
    },
    [template],
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
        // Struttura cambiata: crea nuovo template
        const newTmpl = await createTemplate({
          name: `${template?.name ?? "Template"} (rev)`,
          content: markdown,
          fields: currentPlaceholders.map(apiFieldFromKey),
        });
        if (!isUuid(newTmpl.id)) {
          throw new Error(
            `Template creato senza ID UUID valido: ${newTmpl.id}`,
          );
        }
        setTemplate(newTmpl);
        setTemplates((current) => [
          newTmpl,
          ...current.filter((item) => item.id !== newTmpl.id),
        ]);
        originalPlaceholders.current = extractPlaceholders(newTmpl.content);

        const newDoc = await createDocument({
          name: document?.name ?? "Documento",
          templateId: newTmpl.id,
        });
        const saved = await updateDocument(newDoc.id, {
          fieldValues: { ...fieldValues },
        });
        setDocument(saved);
        setPdfJobs([]);
        setSnack({
          open: true,
          msg: "Struttura cambiata: nuovo template e documento creati.",
          severity: "success",
        });
      } else if (document && isUuid(document.id)) {
        // Documento esistente con UUID: aggiorna solo i valori
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
        // Nessun documento esistente: assicurati di avere un template con UUID
        const activeTmpl = await ensureLocalTemplate(markdown);

        // Se il template è già quello corrente con stesso contenuto, aggiornalo
        if (
          template &&
          isUuid(template.id) &&
          !isGithubTemplate(template) &&
          activeTmpl.id === template.id
        ) {
          await updateTemplate(activeTmpl.id, { content: markdown });
        }

        const newDoc = await createDocument({
          name: "Nuovo Documento",
          templateId: activeTmpl.id,
        });
        setDocument(newDoc);
        setPdfJobs([]);
        setSnack({
          open: true,
          msg: "Template e documento creati.",
          severity: "success",
        });
      }
    } catch (err) {
      setSnack({
        open: true,
        msg: `Errore salvataggio: ${String(err)}`,
        severity: "error",
      });
    } finally {
      setAppStatus("ready");
    }
  }, [markdown, fieldValues, template, document, ensureLocalTemplate]);

  // ── Genera PDF ────────────────────────────────────────────────────────────
  const handleGeneratePdf = useCallback(async () => {
    if (!document || !isUuid(document.id)) {
      setSnack({
        open: true,
        msg: "Salva prima il documento prima di generare il PDF.",
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

  // Genera PDF è abilitato solo se esiste un documento con UUID valido
  const canGeneratePdf = Boolean(document && isUuid(document.id));

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
            canGeneratePdf={canGeneratePdf}
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
                  documentName={document?.name ?? template?.name}
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
