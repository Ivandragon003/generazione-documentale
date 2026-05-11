import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';

export function HeaderBar() {
  return (
    <Box className="header-bar">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Stack direction="row" gap={2} alignItems="center">
          <Box className="doc-icon">DOC</Box>
          <Box>
            <Typography variant="h5">Project Charter</Typography>
            <Typography variant="body2" color="text.secondary">
              Package 1 · 23/04/2026 · Paolo V · v1.0 · 1.2 MB
            </Typography>
            <Chip label="Non Generato" color="secondary" size="small" sx={{ mt: 1 }} />
          </Box>
        </Stack>
        <Stack direction="row" gap={1}>
          <Button variant="outlined" startIcon={<HistoryIcon />}>Versioni</Button>
          <Button variant="outlined" color="inherit" startIcon={<CloseIcon />}>Chiudi</Button>
          <Button variant="contained" startIcon={<SaveIcon />}>Salva</Button>
        </Stack>
      </Stack>
    </Box>
  );
}
