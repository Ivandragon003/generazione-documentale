import { grey } from "@mui/material/colors";
import type { SxProps, Theme } from "@mui/material/styles";

export const NAVBAR_HEIGHT = 40;

export const navbarSx = {
  appBar: {
    position: "sticky",
    top: 0,
    height: NAVBAR_HEIGHT,
    backgroundColor: "common.white",
    color: "text.secondary",
    boxShadow: 0,
    borderBottom: `1px solid ${grey[300]}`,
    justifyContent: "center",
  } satisfies SxProps<Theme>,
  toolbar: {
    minHeight: `${NAVBAR_HEIGHT}px`,
    display: "flex",
    alignItems: "center",
    padding: (theme) => theme.spacing(0, 2, 0, 0),
  } satisfies SxProps<Theme>,
  sidebarToggleButton: (collapsed: boolean): SxProps<Theme> => ({
    width: 40,
    height: 40,
    padding: 0,
    borderRadius: 0,
    transition: (theme) =>
      theme.transitions.create("transform", {
        duration: theme.transitions.duration.shortest,
      }),
    "& svg": {
      fontSize: (theme) => theme.typography.pxToRem(14),
      transform: collapsed ? "rotate(-90deg)" : "rotate(90deg)",
    },
  }),
  projectInputWrap: {
    display: "flex",
    alignItems: "center",
    marginLeft: (theme) => theme.spacing(1),
  } satisfies SxProps<Theme>,
  projectInput: {
    width: 220,
    marginTop: (theme) => theme.spacing(1),
    color: "text.secondary",
    "& input": {
      color: "text.secondary",
    },
    "& input::placeholder": {
      color: "text.secondary",
      opacity: 1,
    },
  } satisfies SxProps<Theme>,
  spacer: {
    flexGrow: 1,
  } satisfies SxProps<Theme>,
  actions: {
    display: "flex",
    alignItems: "center",
    gap: (theme) => theme.spacing(1),
  } satisfies SxProps<Theme>,
  searchField: {
    width: 136,
  } satisfies SxProps<Theme>,
  avatarButton: {
    padding: 0,
  } satisfies SxProps<Theme>,
} as const;
