import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

type Props = {
  readonly open: boolean;
  readonly createMode: "create" | "import";
  readonly name: string;
  readonly selectedCategory: string;
  readonly categoryOptions: string[];
  readonly pendingUploadFileName: string | null;
  readonly onClose: () => void;
  readonly onModeChange: (value: "create" | "import") => void;
  readonly onNameChange: (value: string) => void;
  readonly onCategoryChange: (value: string) => void;
  readonly onChooseFile: () => void;
  readonly onConfirm: () => void;
};

export function CreateTemplateDialog({
  open,
  createMode,
  name,
  selectedCategory,
  categoryOptions,
  pendingUploadFileName,
  onClose,
  onModeChange,
  onNameChange,
  onCategoryChange,
  onChooseFile,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>New template</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <ToggleButtonGroup
            exclusive
            value={createMode}
            onChange={(_, value: "create" | "import" | null) => {
              if (value) onModeChange(value);
            }}
            size="small"
          >
            <ToggleButton value="create">Create</ToggleButton>
            <ToggleButton value="import">Import MD</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            label="Template name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. services-contract"
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id="category-label">Folder</InputLabel>
            <Select
              labelId="category-label"
              label="Folder"
              value={selectedCategory}
              disabled={categoryOptions.length === 0}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              {categoryOptions.length === 0 && (
                <MenuItem value="">No GitHub folders available</MenuItem>
              )}
              {categoryOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {createMode === "import" && (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="body2" color="text.secondary">
                {pendingUploadFileName ?? "No .md file selected"}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={onChooseFile}
              >
                Choose .md
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={onConfirm}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
