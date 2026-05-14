import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { type ReactNode, useState } from "react";
import Navbar from "./navbar/Navbar";
import { Sidebar, type SidebarSectionKey } from "./sidebar/Sidebar";

const rootLayoutSx: SxProps<Theme> = {
  display: "flex",
  minHeight: "100vh",
  width: "100%",
};

const rootLayoutContentSx: SxProps<Theme> = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const rootLayoutOutletSx: SxProps<Theme> = {
  flex: 1,
  minWidth: 0,
};

interface RootLayoutProps {
  readonly activeSection: SidebarSectionKey;
  readonly onSectionChange: (section: SidebarSectionKey) => void;
  readonly children: ReactNode;
}

export function RootLayout({
  activeSection,
  onSectionChange,
  children,
}: RootLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <Box sx={rootLayoutSx}>
      <Sidebar
        collapsed={sidebarCollapsed}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      />
      <Box sx={rootLayoutContentSx}>
        <Navbar
          collapsed={sidebarCollapsed}
          onSidebarToggle={() => setSidebarCollapsed((current) => !current)}
        />
        <Box sx={rootLayoutOutletSx}>{children}</Box>
      </Box>
    </Box>
  );
}
