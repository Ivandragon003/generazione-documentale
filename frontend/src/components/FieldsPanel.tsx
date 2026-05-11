import { Box, Paper, Stack, TextField, Typography } from '@mui/material';
import type { TemplateField } from '../data/mock';

type Props = {
  fields: TemplateField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
};

export function FieldsPanel({ fields, values, onChange }: Props) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {fields.map((field) => {
        const multiline = field.type === 'longText';
        const half = field.type === 'text' || field.type === 'currency' || field.type === 'date';
        return (
          <Box key={field.key} sx={{ gridColumn: { xs: 'span 1', md: half ? 'span 1' : '1 / -1' } }}>
            <Paper className="field-card">
              <Stack gap={1.5}>
                <Typography variant="subtitle1">{field.label}</Typography>
                <TextField
                  fullWidth
                  multiline={multiline}
                  minRows={multiline ? 4 : 1}
                  placeholder={field.placeholder}
                  value={values[field.key] ?? ''}
                  onChange={(event) => onChange(field.key, event.target.value)}
                />
              </Stack>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}
