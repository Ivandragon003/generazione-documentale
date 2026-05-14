import { grey } from "@mui/material/colors";
import type { SxProps, Theme } from "@mui/material/styles";

export const SIDEBAR_WIDTH = 228;
export const SIDEBAR_COLLAPSED_WIDTH = 40;

const navSectionSx: SxProps<Theme> = {
  display: "flex",
  flexDirection: "column",
  gap: (theme) => theme.spacing(0.25),
};

const topNavSectionSx: SxProps<Theme> = {
  marginBottom: (theme) => theme.spacing(1.25),
};

const accordionContainerSx: SxProps<Theme> = {
  padding: (theme) => theme.spacing(1.5),
};

export const sidebarSx = {
  drawer: (collapsed: boolean): SxProps<Theme> => ({
    width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    flexShrink: 0,
    transition: (theme) =>
      theme.transitions.create("width", {
        duration: theme.transitions.duration.standard,
        easing: theme.transitions.easing.easeInOut,
      }),
  }),
  drawerPaper: (collapsed: boolean): SxProps<Theme> => ({
    width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    borderRight: "none",
    backgroundColor: grey[100],
    padding: (theme) => theme.spacing(1.5, 0),
    overflowX: "hidden",
    transition: (theme) =>
      theme.transitions.create(["width", "padding"], {
        duration: theme.transitions.duration.standard,
        easing: theme.transitions.easing.easeInOut,
      }),
  }),
  header: (collapsed: boolean): SxProps<Theme> => ({
    padding: (theme) => (collapsed ? 0 : theme.spacing(0, 1.5)),
    width: collapsed ? "100%" : undefined,
    display: collapsed ? "flex" : undefined,
    justifyContent: collapsed ? "center" : undefined,
  }),
  logoContainer: (collapsed: boolean): SxProps<Theme> => ({
    display: "flex",
    alignItems: "center",
    width: collapsed ? 36 : undefined,
    height: 36,
    padding: (theme) =>
      theme.spacing(collapsed ? 0.75 : 0.5, collapsed ? 0.75 : 2),
    borderRadius: collapsed ? "50%" : "24px",
    backgroundColor: "common.white",
    marginBottom: (theme) => theme.spacing(2),
  }),
  searchRow: {
    display: "flex",
    alignItems: "center",
    gap: (theme) => theme.spacing(1),
    marginBottom: (theme) => theme.spacing(1),
  } satisfies SxProps<Theme>,
  scrollArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: (theme) => theme.spacing(2),
  } satisfies SxProps<Theme>,
  topNavContainer: {
    ...navSectionSx,
    ...topNavSectionSx,
  } satisfies SxProps<Theme>,
  accordionSection: {
    ...navSectionSx,
    ...accordionContainerSx,
  } satisfies SxProps<Theme>,
  footer: (collapsed: boolean): SxProps<Theme> => ({
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "flex-end" : "space-between",
    flexDirection: collapsed ? "column-reverse" : "row",
    gap: (theme) => theme.spacing(1),
    padding: (theme) =>
      collapsed
        ? theme.spacing(0, 1.5, 0.75, 1.5)
        : theme.spacing(1, 1.5, 0, 1.5),
    width: collapsed ? "100%" : undefined,
  }),
  footerIcons: (collapsed: boolean): SxProps<Theme> => ({
    display: "flex",
    gap: (theme) => theme.spacing(0.5),
    flexDirection: collapsed ? "column" : "row",
  }),
};
