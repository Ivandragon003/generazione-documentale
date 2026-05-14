import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivitiesIcon } from "../../assets/icons/ActivitiesIcon";
import { ClockIcon } from "../../assets/icons/ClockIcon";
import { EyeIcon } from "../../assets/icons/EyeICon";
import { FilterICon } from "../../assets/icons/FilterIcon";
import { JoinIcon } from "../../assets/icons/JoinIcon";
import { PortfolioIcon } from "../../assets/icons/PortfolioIcon";
import { ProgramsIcon } from "../../assets/icons/ProgramsIcon";
import { ProjectsIcon } from "../../assets/icons/ProjectsIcon";
import { RocketIcon } from "../../assets/icons/RocketIcon";
import { StarIcon } from "../../assets/icons/StarIcon";
import { TemplateIcon } from "../../assets/icons/TemplateIcon";
import { UserIcon } from "../../assets/icons/UserIcon";
import { PM3Logo } from "../../assets/PM3Logo";
import { AppIconButton } from "../../shared/ui/AppIconButton";
import type { IconTileColorKey } from "../../shared/ui/iconTileColors";
import { SearchField } from "../../shared/ui/SearchField";
import { sidebarSx } from "./Sidebar.styles";
import { SidebarCreateButton } from "./SidebarCreateButton";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarSectionAccordion } from "./SidebarSectionAccordion";

export type SidebarSectionKey =
  | "for-you"
  | "recent"
  | "favorites"
  | "all"
  | "portfolio"
  | "programs"
  | "projects"
  | "activities"
  | "templates"
  | "join";

type TopItem = {
  key: SidebarSectionKey;
  labelKey: string;
  icon: ReactNode;
};

type SectionItem = {
  key: SidebarSectionKey;
  labelKey: string;
  icon: ReactNode;
  colorKey: IconTileColorKey;
  defaultExpanded?: boolean;
};

const topItems: TopItem[] = [
  { key: "for-you", labelKey: "sidebar.top.forYou", icon: <UserIcon /> },
  { key: "recent", labelKey: "sidebar.top.recent", icon: <ClockIcon /> },
  { key: "favorites", labelKey: "sidebar.top.favorites", icon: <StarIcon /> },
  { key: "all", labelKey: "sidebar.top.all", icon: <RocketIcon /> },
] as const;

const sections: SectionItem[] = [
  {
    key: "portfolio",
    labelKey: "sidebar.sections.portfolio",
    icon: <PortfolioIcon />,
    colorKey: "portfolio",
  },
  {
    key: "programs",
    labelKey: "sidebar.sections.programs",
    icon: <ProgramsIcon />,
    colorKey: "programs",
  },
  {
    key: "projects",
    labelKey: "sidebar.sections.projects",
    icon: <ProjectsIcon />,
    colorKey: "projects",
  },
  {
    key: "activities",
    labelKey: "sidebar.sections.activities",
    icon: <ActivitiesIcon />,
    colorKey: "activities",
  },
  {
    key: "templates",
    labelKey: "sidebar.sections.template",
    icon: <TemplateIcon />,
    colorKey: "template",
    defaultExpanded: true,
  },
  {
    key: "join",
    labelKey: "sidebar.sections.join",
    icon: <JoinIcon />,
    colorKey: "join",
  },
] as const;

type SidebarProps = {
  collapsed?: boolean;
  activeSection: SidebarSectionKey;
  onSectionChange: (section: SidebarSectionKey) => void;
};

export function Sidebar({
  collapsed = false,
  activeSection,
  onSectionChange,
}: SidebarProps) {
  const { t } = useTranslation();

  return (
    <Drawer
      anchor="left"
      open
      sx={sidebarSx.drawer(collapsed)}
      slotProps={{
        paper: { elevation: 0, sx: sidebarSx.drawerPaper(collapsed) },
      }}
      variant="permanent"
    >
      <Box sx={sidebarSx.header(collapsed)}>
        <Box sx={sidebarSx.logoContainer(collapsed)}>
          {collapsed ? (
            <Box>
              <PM3Logo />
            </Box>
          ) : (
            <PM3Logo />
          )}
        </Box>

        {!collapsed && (
          <Box sx={sidebarSx.searchRow}>
            <SearchField fullWidth />
            <AppIconButton aria-label={t("sidebar.actions.filterResults")}>
              <FilterICon />
            </AppIconButton>
          </Box>
        )}
      </Box>

      {!collapsed ? (
        <Box sx={sidebarSx.scrollArea}>
          <Box sx={sidebarSx.topNavContainer}>
            {topItems.map((item) => (
              <SidebarNavItem
                key={item.key}
                active={activeSection === item.key}
                icon={item.icon}
                label={t(item.labelKey)}
                onClick={() => onSectionChange(item.key)}
              />
            ))}
          </Box>

          <Box sx={sidebarSx.accordionSection}>
            {sections.map((section) => (
              <SidebarSectionAccordion
                key={section.key}
                colorKey={section.colorKey}
                defaultExpanded={section.defaultExpanded}
                icon={section.icon}
                label={t(section.labelKey)}
                active={activeSection === section.key}
                onClick={() => onSectionChange(section.key)}
              />
            ))}
          </Box>
        </Box>
      ) : (
        <Box sx={sidebarSx.scrollArea} />
      )}

      <Box sx={sidebarSx.footer(collapsed)}>
        <SidebarCreateButton collapsed={collapsed} />
        <Box sx={sidebarSx.footerIcons(collapsed)}>
          <AppIconButton aria-label={t("sidebar.actions.previewSidebar")}>
            <EyeIcon />
          </AppIconButton>
          <AppIconButton aria-label={t("sidebar.actions.joinWorkspace")}>
            <JoinIcon />
          </AppIconButton>
        </Box>
      </Box>
    </Drawer>
  );
}
