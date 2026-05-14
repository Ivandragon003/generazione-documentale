import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Input from "@mui/material/Input";
import Toolbar from "@mui/material/Toolbar";
import { useTranslation } from "react-i18next";
import { CaretIcon } from "../../assets/icons/CaretIcon";
import { ProjectsIcon } from "../../assets/icons/ProjectsIcon";
import SettingsOutlinedIcon from "../../assets/icons/SettingsOutlinedIcon";
import UserAvatarIcon from "../../assets/icons/UserAvatarIcon";
import { IconTile } from "../../shared/ui/IconTile";
import { SearchField } from "../../shared/ui/SearchField";
import { navbarSx } from "./Navbar.styles";

type NavbarProps = {
  collapsed: boolean;
  onSidebarToggle: () => void;
};

function Navbar({ collapsed, onSidebarToggle }: NavbarProps) {
  const { t } = useTranslation();

  return (
    <AppBar elevation={0} sx={navbarSx.appBar}>
      <Toolbar disableGutters sx={navbarSx.toolbar}>
        <IconButton
          aria-label={
            collapsed ? t("navbar.openSidebar") : t("navbar.collapseSidebar")
          }
          onClick={onSidebarToggle}
          sx={navbarSx.sidebarToggleButton(collapsed)}
        >
          <CaretIcon />
        </IconButton>

        <IconTile colorKey="projects">
          <ProjectsIcon />
        </IconTile>

        <Box sx={navbarSx.projectInputWrap}>
          <Input
            aria-label={t("navbar.projectNameLabel")}
            disableUnderline
            placeholder={t("navbar.projectNamePlaceholder")}
            sx={navbarSx.projectInput}
          />
        </Box>

        <Box sx={navbarSx.spacer} />

        <Box sx={navbarSx.actions}>
          <SearchField sx={navbarSx.searchField} />
          <IconButton aria-label={t("navbar.settings")} size="small">
            <SettingsOutlinedIcon />
          </IconButton>
          <IconButton
            aria-label={t("navbar.userProfile")}
            sx={navbarSx.avatarButton}
          >
            <UserAvatarIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
