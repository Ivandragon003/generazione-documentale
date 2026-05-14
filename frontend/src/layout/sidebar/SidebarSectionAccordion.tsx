import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import type { SxProps, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";
import { CaretIcon } from "../../assets/icons/CaretIcon";
import { IconTile } from "../../shared/ui/IconTile";
import type { IconTileColorKey } from "../../shared/ui/iconTileColors";

type SidebarSectionAccordionProps = {
  icon: ReactNode;
  label: string;
  colorKey: IconTileColorKey;
  defaultExpanded?: boolean;
  children?: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

const accordionSx: SxProps<Theme> = {
  backgroundColor: "transparent",
  "&::before": {
    display: "none",
  },
};

const accordionSummarySx = (active: boolean): SxProps<Theme> => ({
  minHeight: 28,
  height: 28,
  padding: (theme) => theme.spacing(0, 1, 0, 0.5),
  borderRadius: 0,
  backgroundColor: active ? "rgba(37, 99, 235, 0.08)" : "transparent",
  borderBottom: "1px solid",
  borderColor: "grey.300",
  "&.Mui-expanded": {
    minHeight: 28,
    height: 28,
  },
  "& .MuiAccordionSummary-content": {
    margin: (theme) => `${theme.spacing(0.75)} 0`,
    alignItems: "center",
    gap: (theme) => theme.spacing(1),
  },
  "& .MuiAccordionSummary-content.Mui-expanded": {
    margin: (theme) => `${theme.spacing(0.75)} 0`,
  },
});

const accordionTitleSx: SxProps<Theme> = {
  display: "flex",
  alignItems: "center",
  gap: (theme) => theme.spacing(1),
  flex: 1,
};

const accordionLabelSx: SxProps<Theme> = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const checkboxSx: SxProps<Theme> = {
  "&.Mui-checked": {
    color: "primary.main",
  },
};

const accordionDetailsSx: SxProps<Theme> = {
  padding: 0,
  backgroundColor: "transparent",
};

export function SidebarSectionAccordion({
  icon,
  label,
  colorKey,
  defaultExpanded = false,
  children,
  active = false,
  onClick,
}: SidebarSectionAccordionProps) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      elevation={0}
      sx={accordionSx}
      square
      onChange={() => onClick?.()}
    >
      <AccordionSummary
        expandIcon={<CaretIcon />}
        sx={accordionSummarySx(active)}
      >
        <Box sx={accordionTitleSx}>
          <IconTile colorKey={colorKey}>{icon}</IconTile>
          <Typography sx={accordionLabelSx}>{label}</Typography>
        </Box>
        <Checkbox disableRipple sx={checkboxSx} checked={active} />
      </AccordionSummary>
      <AccordionDetails sx={accordionDetailsSx}>{children}</AccordionDetails>
    </Accordion>
  );
}
