import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/@mui/icons-material/")) {
            return "mui-icons";
          }
          if (id.includes("node_modules/@mui/x-date-pickers/")) {
            return "mui-pickers";
          }
          if (id.includes("node_modules/@mui/")) return "mui-vendor";
          if (
            id.includes("node_modules/i18next/") ||
            id.includes("node_modules/react-i18next/") ||
            id.includes("node_modules/i18next-browser-languagedetector/")
          ) {
            return "i18n-vendor";
          }
          if (id.includes("node_modules/dayjs")) return "date-vendor";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 4173,
    host: "0.0.0.0",
  },
});
