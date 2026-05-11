import { useMemo, useState } from 'react';
import { AppBar, Box, Container, Paper, Tab, Tabs, Typography } from '@mui/material';
import { HeaderBar } from './components/HeaderBar';
import { TemplateEditor } from './components/TemplateEditor';
import { FieldsPanel } from './components/FieldsPanel';
import { PdfPreview } from './components/PdfPreview';
import { initialFieldValues, initialTemplate, type TemplateField } from './data/mock';
import { comparePlaceholderSets, extractPlaceholders, renderMarkdown } from './utils/template';

const tabLabels = ['Template', 'Campi', 'Anteprima PDF'];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);
  const [markdown, setMarkdown] = useState(initialTemplate.markdown);
  const [fields] = useState<TemplateField[]>(initialTemplate.fields);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(initialFieldValues);

  const originalPlaceholders = useMemo(() => extractPlaceholders(initialTemplate.markdown), []);
  const currentPlaceholders = useMemo(() => extractPlaceholders(markdown), [markdown]);
  const diff = useMemo(
    () => comparePlaceholderSets(originalPlaceholders, currentPlaceholders),
    [originalPlaceholders, currentPlaceholders]
  );

  const visibleFields = useMemo(() => {
    const currentKeys = new Set(currentPlaceholders);
    const mapped = fields.filter((field) => currentKeys.has(field.key));
    const missing = currentPlaceholders
      .filter((key) => !mapped.some((field) => field.key === key))
      .map((key) => ({ key, label: key, type: 'text' as const, placeholder: `Valore per ${key}` }));
    return [...mapped, ...missing];
  }, [currentPlaceholders, fields]);

  const rendered = useMemo(() => renderMarkdown(markdown, fieldValues), [markdown, fieldValues]);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', pb: 6 }}>
      <AppBar position="static" color="transparent" elevation={0} className="top-appbar">
        <Container maxWidth="xl">
          <HeaderBar />
        </Container>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        <Paper className="workspace-shell">
          <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)}>
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
                onChange={(key, value) => setFieldValues((current) => ({ ...current, [key]: value }))}
              />
            )}

            {activeTab === 2 && <PdfPreview content={rendered} />}
          </Box>
        </Paper>

        <Paper className="architecture-note">
          <Typography variant="h6" gutterBottom>MAC frontend foundation</Typography>
          <Typography variant="body2" color="text.secondary">
            Questo prototipo è isolato in una cartella frontend separata, coerente con una base React + Vite + TypeScript + MUI,
            e prepara il terreno per evolvere verso shell app, microfrontend, BFF e design system condiviso.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}
