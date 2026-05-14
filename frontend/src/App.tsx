import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { RootLayout } from "./layout/RootLayout";
import type { SidebarSectionKey } from "./layout/sidebar/Sidebar";
import { TemplatesWorkspace } from "./modules/templates/TemplatesWorkspace";

function PlaceholderSection({ title }: { readonly title: string }) {
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
        <Typography color="text.secondary">
          This section is a dashboard placeholder. Only Templates is connected.
        </Typography>
      </Paper>
    </Box>
  );
}

export default function App() {
  const [activeSection, setActiveSection] =
    useState<SidebarSectionKey>("templates");

  const content =
    activeSection === "templates" ? (
      <TemplatesWorkspace />
    ) : (
      <PlaceholderSection
        title={activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
      />
    );

  return (
    <RootLayout
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    >
      {content}
    </RootLayout>
  );
}
