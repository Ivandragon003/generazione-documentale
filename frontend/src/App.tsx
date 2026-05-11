import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '@mui/material';
import { HeaderBar } from './components/HeaderBar';
import { TemplateEditor } from './components/TemplateEditor';
import { FieldsPanel } from './components/FieldsPanel';
import { PdfPreview } from './components/PdfPreview';
import { type TemplateField } from './data/mock';
import {
  type DocumentDto,
  type PdfJobDto,
  type TemplateDto,
  createDocument,
  createTemplate,
  getDocuments,
  getTemplates,
  getPdfJobs,
  triggerPdfGeneration,
  updateDocument,
  updateTemplate,
} from './data/api';
import { comparePlaceholderSets, extractPlaceholders, renderMarkdown } from './utils/template';

const tabLabels = ['Template', 'Campi', 'Anteprima PDF'];

// ─────────────────────────────────────────────────────────────────────────────
// Tipi di stato dell'applicazione
// ─────────────────────────────────────────────────────────────────────────────
type AppStatus = 'loading' | 'ready' | 'saving' | 'error';

export default function App() {
  // ── stato UI ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(0);
  const [appStatus, setAppStatus] = useState<AppStatus>('loading');
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>(
    { open: false, msg: '', severity: 'success' },
  );

  // ── dati dal backend ──────────────────────────────────────────────────────
  const [template, setTemplate] = useState<TemplateDto | null>(null);
  const [document, setDocument] = useState<DocumentDto | null>(null);
  const [pdfJobs, setPdfJobs] = useState<PdfJobDto[]>([]);

  // ── stato editor (locale, sincronizzato al salvataggio) ──────────────────
  const [markdown, setMarkdown] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // placeholder originali del template caricato (usati per rilevare struttura cambiata)
  const originalPlaceholders = useRef<string[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Boot: carica il primo template e il primo documento dal backend
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const [tmplRes, docRes] = await Promise.all([getTemplates(), getDocuments()]);

        if (cancelled) return;

        const firstTemplate = tmplRes.data[0] ?? null;
        const firstDocument = docRes.data[0] ?? null;

        if (firstTemplate) {
          setTemplate(firstTemplate);
          setMarkdown(firstTemplate.content);
          originalPlaceholders.current = extractPlaceholders(firstTemplate.content);
        }

        if (firstDocument) {
          setDocument(firstDocument);
          // i field_values del documento prevalgono
          const fv: Record<string, string> = {};
          for (const [k, v] of Object.entries(firstDocument.field_values ?? {})) {
            fv[k] = v != null ? String(v) : '';
          }
          setFieldValues(fv);

          // carica i job PDF del documento
          const jobs = await getPdfJobs(firstDocument.id);
          if (!cancelled) setPdfJobs(jobs);
        }

        setAppStatus('ready');
      } catch (err) {
        if (!cancelled) {
          console.error('[boot]', err);
          setAppStatus('error');
          setSnack({ open: true, msg: 'Impossibile connettersi al backend.', severity: 'error' });
        }
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Salvataggio
  // ─────────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setAppStatus('saving');
    try {
      const currentPlaceholders = extractPlaceholders(markdown);
      const diff = comparePlaceholderSets(originalPlaceholders.current, currentPlaceholders);
      const structureChanged = diff.added.length > 0 || diff.removed.length > 0;

      if (structureChanged) {
        // ── struttura cambiata: crea nuovo template + nuovo documento ──────
        const newTmpl = await createTemplate({
          name: (template?.name ?? 'Template') + ' (rev)',
          content: markdown,
          fields: currentPlaceholders.map((key) => ({
            key,
            label: key,
            type: 'text' as const,
            required: false,
          })),
        });
        setTemplate(newTmpl);
        originalPlaceholders.current = extractPlaceholders(newTmpl.content);

        const newDoc = await createDocument({
          name: document?.name ?? 'Documento',
          templateId: newTmpl.id,
        });
        // aggiorna subito i field_values sul nuovo documento
        const saved = await updateDocument(newDoc.id, {
          fieldValues: Object.fromEntries(
            Object.entries(fieldValues).map(([k, v]) => [k, v]),
          ),
        });
        setDocument(saved);
        setSnack({ open: true, msg: 'Struttura cambiata: nuovo template e documento creati.', severity: 'success' });
      } else if (document) {
        // ── solo valori cambiati: aggiorna documento esistente ─────────────
        const saved = await updateDocument(document.id, {
          fieldValues: Object.fromEntries(
            Object.entries(fieldValues).map(([k, v]) => [k, v]),
          ),
        });
        setDocument(saved);
        setSnack({ open: true, msg: 'Documento salvato.', severity: 'success' });
      } else {
        // ── nessun documento ancora: crea template + documento ────────────
        const newTmpl = template
          ? await updateTemplate(template.id, { content: markdown })
          : await createTemplate({
              name: 'Nuovo Template',
              content: markdown,
              fields: currentPlaceholders.map((key) => ({
                key,
                label: key,
                type: 'text' as const,
                required: false,
              })),
            });
        setTemplate(newTmpl);
        originalPlaceholders.current = extractPlaceholders(newTmpl.content);

        const newDoc = await createDocument({
          name: 'Nuovo Documento',
          templateId: newTmpl.id,
        });
        setDocument(newDoc);
        setSnack({ open: true, msg: 'Template e documento creati.', severity: 'success' });
      }
    } catch (err) {
      console.error('[save]', err);
      setSnack({ open: true, msg: `Errore salvataggio: ${String(err)}`, severity: 'error' });
    } finally {
      setAppStatus('ready');
    }
  }, [markdown, fieldValues, template, document]);

  // ─────────────────────────────────────────────────────────────────────────
  // Genera PDF
  // ─────────────────────────────────────────────────────────────────────────
  const handleGeneratePdf = useCallback(async () => {
    if (!document) {
      setSnack({ open: true, msg: 'Salva prima il documento.', severity: 'error' });
      return;
    }
    try {
      const job = await triggerPdfGeneration(document.id);
      setPdfJobs((prev) => [job, ...prev]);
      setSnack({ open: true, msg: 'Generazione PDF avviata.', severity: 'success' });
    } catch (err) {
      setSnack({ open: true, msg: `Errore PDF: ${String(err)}`, severity: 'error' });
    }
  }, [document]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derivati
  // ─────────────────────────────────────────────────────────────────────────
  const currentPlaceholders = useMemo(() => extractPlaceholders(markdown), [markdown]);

  const diff = useMemo(
    () => comparePlaceholderSets(originalPlaceholders.current, currentPlaceholders),
    [currentPlaceholders],
  );

  const visibleFields = useMemo((): TemplateField[] => {
    const keys = new Set(currentPlaceholders);
    const tmplFields: TemplateField[] = (template?.fields ?? []).filter((f) => keys.has(f.key));
    const extra: TemplateField[] = currentPlaceholders
      .filter((k) => !tmplFields.some((f) => f.key === k))
      .map((k) => ({ key: k, label: k, type: 'text' as const, placeholder: `Valore per ${k}` }));
    return [...tmplFields, ...extra];
  }, [currentPlaceholders, template]);

  const rendered = useMemo(() => renderMarkdown(markdown, fieldValues), [markdown, fieldValues]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (appStatus === 'loading') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 6 }}>
      <AppBar position="static" color="transparent" elevation={0} className="top-appbar">
        <Container maxWidth="xl">
          <HeaderBar
            document={document}
            template={template}
            isSaving={appStatus === 'saving'}
            onSave={handleSave}
            onGeneratePdf={handleGeneratePdf}
            pdfJobs={pdfJobs}
          />
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Paper className="workspace-shell">
          <Tabs value={activeTab} onChange={(_, value: number) => setActiveTab(value)}>
            {tabLabels.map((label) => <Tab key={label} label={label} />)}
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

        {appStatus === 'error' && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Backend non raggiungibile — i dati mostrati sono vuoti. Assicurati che il server sia in esecuzione su <strong>localhost:3000</strong>.
          </Alert>
        )}

        <Paper className="architecture-note" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>MAC Document Editor</Typography>
          <Typography variant="body2" color="text.secondary">
            Editor collegato al backend NestJS. Template e documenti vengono caricati e salvati via API REST.
          </Typography>
        </Paper>
      </Container>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
