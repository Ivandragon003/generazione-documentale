import React from "react";
import ReactDOM from "react-dom/client";
import { createTheme, ThemeProvider } from "@mui/material";
import App from "./App";
import "./styles.css";

// Tema MUI allineato al design system editoriale
const theme = createTheme({
  palette: {
    primary:   { main: "#0d2d6b", light: "#1a4fa8", dark: "#091e4a" },
    secondary: { main: "#c47d1a" },
    background:{ default: "#faf9f7", paper: "#ffffff" },
    text:      { primary: "#0f1923", secondary: "#6b7280" },
    success:   { main: "#166534", light: "#dcfce7" },
    error:     { main: "#991b1b", light: "#fee2e2" },
    warning:   { main: "#92400e", light: "#fef3c7" },
  },
  typography: {
    fontFamily: "'IBM Plex Sans', 'Helvetica Neue', sans-serif",
    fontSize: 14,
  },
  shape: { borderRadius: 10 },
  components: {
    MuiPaper:      { defaultProps: { elevation: 0 } },
    MuiAppBar:     { defaultProps: { elevation: 0 } },
    MuiButton:     { defaultProps: { disableElevation: true } },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
