import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

type Props = {
  readonly open: boolean;
  readonly templateName: string;
  readonly saving: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
};

export function DeleteTemplateDialog({
  open,
  templateName,
  saving,
  onClose,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Delete template</DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          Delete template "{templateName}"?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={saving}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
