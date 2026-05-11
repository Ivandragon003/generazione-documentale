import { Alert, Button, Chip, Divider, Paper, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';

type Props = {
  markdown: string;
  onChange: (value: string) => void;
  placeholders: string[];
  added: string[];
  removed: string[];
};

export function TemplateEditor({ markdown, onChange, placeholders, added, removed }: Props) {
  return (
    <Stack gap={2}>
      <Paper className="panel-shell">
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Button variant="outlined" startIcon={<UploadFileIcon />}>Importa template</Button>
            <Button variant="outlined">Carica documento</Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">Trascina un file .md o .docx</Typography>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Stack direction="row" gap={1} flexWrap="wrap" alignItems="center">
          <Button size="small" variant="text">B</Button>
          <Button size="small" variant="text">I</Button>
          <Button size="small" variant="outlined" startIcon={<AddIcon />}>Crea campo</Button>
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
          InputProps={{ disableUnderline: true, className: 'editor-input' }}
        />
      </Paper>

      <Paper className="panel-shell">
        <Typography variant="subtitle1" gutterBottom>Placeholder rilevati</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {placeholders.map((field) => <Chip key={field} label={field} color="primary" variant="outlined" />)}
        </Stack>
        {(added.length > 0 || removed.length > 0) && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Hai modificato la struttura del template. Nuovi campi: {added.join(', ') || 'nessuno'}. Rimossi: {removed.join(', ') || 'nessuno'}.
            Questa operazione dovrebbe generare una nuova versione del template.
          </Alert>
        )}
      </Paper>
    </Stack>
  );
}
