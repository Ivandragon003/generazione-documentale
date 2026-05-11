import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import ReactMarkdown from 'react-markdown';

type Props = {
  content: string;
};

export function PdfPreview({ content }: Props) {
  return (
    <Stack gap={2}>
      <Paper className="panel-shell">
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" gap={2} alignItems="center">
            <Typography variant="body2">1 / 2</Typography>
            <Typography variant="body2" color="text.secondary">100%</Typography>
          </Stack>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" startIcon={<PrintIcon />}>Stampa</Button>
            <Button variant="contained" startIcon={<DownloadIcon />}>Scarica</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper className="preview-sheet">
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Box className="logo-box">LOGO</Box>
            <Typography variant="caption" color="text.secondary">Confidenziale · v1.0</Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="body2">Documento: <strong>Project Charter</strong></Typography>
            <Typography variant="body2" color="text.secondary">Versione: 1.0 · Data: 23/04/2026</Typography>
            <Typography variant="body2" color="text.secondary">Autore: Paolo V</Typography>
          </Box>
        </Stack>
        <Divider sx={{ my: 4 }} />
        <Box className="markdown-preview">
          <ReactMarkdown>{content}</ReactMarkdown>
        </Box>
      </Paper>
    </Stack>
  );
}
