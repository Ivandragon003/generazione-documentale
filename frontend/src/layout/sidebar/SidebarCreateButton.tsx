import Button from "@mui/material/Button";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { AddIcon } from "../../assets/icons/AddIcon";

type SidebarCreateButtonProps = {
  collapsed?: boolean;
  label?: string;
};

const createButtonSx = (collapsed: boolean): SxProps<Theme> => ({
  minWidth: collapsed ? 30 : 86,
  width: collapsed ? 30 : undefined,
  minHeight: collapsed ? 30 : 31,
  height: collapsed ? 30 : undefined,
  borderRadius: "4px",
  padding: (theme) => (collapsed ? 0 : theme.spacing(0.75, 1.25)),
  boxShadow: "none",
  "& .MuiButton-startIcon": {
    marginLeft: 0,
  },
  "& .MuiButton-startIcon > *:nth-of-type(1), & > .MuiSvgIcon-root": {
    fontSize: 12,
    flexShrink: 0,
  },
});

export function SidebarCreateButton({
  collapsed = false,
  label,
}: SidebarCreateButtonProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("common.create");

  return (
    <Button
      aria-label={collapsed ? resolvedLabel : undefined}
      disableElevation
      sx={createButtonSx(collapsed)}
      variant="contained"
      startIcon={collapsed ? undefined : <AddIcon />}
    >
      {collapsed ? <AddIcon /> : resolvedLabel}
    </Button>
  );
}
