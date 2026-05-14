import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";

type SidebarNavItemProps = {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

const navItemSx = (active: boolean): SxProps<Theme> => ({
  height: 30,
  gap: (theme) => theme.spacing(1.25),
  color: "text.secondary",
  ...(active
    ? {
        backgroundColor: "primary.main",
        color: "primary.contrastText",
        "&:hover": {
          backgroundColor: "primary.dark",
        },
      }
    : null),
});

const navItemIconSx: SxProps<Theme> = {
  minWidth: 14,
  color: "inherit",
};

const navItemTextSx: SxProps<Theme> = {
  "& .MuiTypography-root": {
    color: "inherit",
  },
};

export function SidebarNavItem({
  icon,
  label,
  active = false,
  onClick,
}: SidebarNavItemProps) {
  return (
    <ListItemButton sx={navItemSx(active)} onClick={onClick}>
      <ListItemIcon sx={navItemIconSx}>{icon}</ListItemIcon>
      <ListItemText primary={label} sx={navItemTextSx} />
    </ListItemButton>
  );
}
