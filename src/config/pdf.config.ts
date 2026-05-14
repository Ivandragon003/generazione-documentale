/**
 * pdf.config.ts
 *
 * Centralized configuration layer for PDF generation.
 * All env variables are read, validated, and normalized here.
 * The service never reads process.env directly.
 *
 * Supported variables:
 *   PDF_ENGINE           pandoc engine (default: xelatex) â€” override for debug/test
 *   PDF_PAPER            paper format: a4, letter, a3 (default: a4)
 *   PDF_FONT_SIZE        font size: 10pt, 11pt, 12pt (default: 11pt)
 *   PDF_MARGIN_TOP       top margin (default: 2.5cm)
 *   PDF_MARGIN_BOTTOM    bottom margin (default: 2.5cm)
 *   PDF_MARGIN_LEFT      left margin (default: 2.5cm)
 *   PDF_MARGIN_RIGHT     right margin (default: 2.5cm)
 *   PDF_MAIN_FONT        body font (default: Liberation Serif)
 *   PDF_SANS_FONT        sans font (default: Liberation Sans)
 *   PDF_MONO_FONT        mono font (default: Liberation Mono)
 *   PDF_LINE_STRETCH     line stretch 1.0â€“2.0 (default: 1.25)
 *   PDF_COLOR_LINKS      enable colored links: true|false (default: true)
 *   PDF_LINK_COLOR       pandoc link color (default: teal)
 *   PANDOC_PATH          pandoc binary path (default: pandoc)
 *   STORAGE_PATH         PDF output folder (default: ./storage/pdf)
 *   PDF_GENERATION_TIMEOUT_MS   job timeout (default: 120000)
 *   PDF_GENERATION_RETRIES      retry attempts (default: 2)
 *   PDF_GENERATION_RETRY_DELAY_MS retry delay (default: 1000)
 *   MAX_PDF_MARKDOWN_BYTES      input size limit (default: 300000)
 */

import { Logger } from "@nestjs/common";

export interface PdfConfig {
  engine: string;
  paper: string;
  fontSize: string;
  marginTop: string;
  marginBottom: string;
  marginLeft: string;
  marginRight: string;
  mainFont: string;
  sansFont: string;
  monoFont: string;
  lineStretch: number;
  colorLinks: boolean;
  linkColor: string;
  pandocPath: string;
  storagePath: string;
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  maxMarkdownBytes: number;
}

const ALLOWED_ENGINES = ["xelatex", "lualatex", "pdflatex"] as const;
const ALLOWED_PAPERS = ["a4", "a3", "a5", "letter", "legal"] as const;
const ALLOWED_FONT_SIZES = ["9pt", "10pt", "11pt", "12pt", "14pt"] as const;
const MARGIN_PATTERN = /^\d+(\.\d+)?(cm|mm|in|pt|em)$/;
const LINE_STRETCH_MIN = 1;
const LINE_STRETCH_MAX = 2;

const validateEnum = <T extends string>(
  value: string,
  allowed: readonly T[],
  varName: string,
  fallback: T,
): { value: T; error?: string } => {
  if ((allowed as readonly string[]).includes(value)) {
    return { value: value as T };
  }
  return {
    value: fallback,
    error: `${varName}="${value}" invalid (allowed: ${allowed.join(", ")}), using default "${fallback}"`,
  };
};

const validateMargin = (
  raw: string | undefined,
  varName: string,
  fallback: string,
): { value: string; error?: string } => {
  const v = raw?.trim() ?? fallback;
  if (MARGIN_PATTERN.test(v)) return { value: v };
  return {
    value: fallback,
    error: `${varName}="${v}" invalid (example: 2.5cm, 20mm, 1in), using default "${fallback}"`,
  };
};

const validatePositiveInt = (
  raw: string | undefined,
  varName: string,
  fallback: number,
  min = 1,
): { value: number; error?: string } => {
  const parsed = Math.round(Number.parseFloat(raw ?? ""));
  if (Number.isInteger(parsed) && parsed >= min) return { value: parsed };
  return {
    value: fallback,
    error: `${varName}="${raw}" invalid (integer >= ${min}), using default ${fallback}`,
  };
};

const validateLineStretch = (
  raw: string | undefined,
): { value: number; error?: string } => {
  const parsed = Number.parseFloat(raw ?? "");
  if (
    !Number.isNaN(parsed) &&
    parsed >= LINE_STRETCH_MIN &&
    parsed <= LINE_STRETCH_MAX
  ) {
    return { value: Math.round(parsed * 100) / 100 };
  }
  return {
    value: 1.25,
    error: `PDF_LINE_STRETCH="${raw}" invalid (1.0â€“2.0), using default 1.25`,
  };
};

// â”€â”€â”€ Builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const buildPdfConfig = (): PdfConfig => {
  const logger = new Logger("pdf.config");
  const warnings: string[] = [];

  const track = <T>(result: { value: T; error?: string }): T => {
    if (result.error) warnings.push(result.error);
    return result.value;
  };

  const engine = track(
    validateEnum(
      process.env.PDF_ENGINE ?? "xelatex",
      ALLOWED_ENGINES,
      "PDF_ENGINE",
      "xelatex",
    ),
  );

  const paper = track(
    validateEnum(
      (process.env.PDF_PAPER ?? "a4").toLowerCase(),
      ALLOWED_PAPERS,
      "PDF_PAPER",
      "a4",
    ),
  );

  const fontSize = track(
    validateEnum(
      process.env.PDF_FONT_SIZE ?? "11pt",
      ALLOWED_FONT_SIZES,
      "PDF_FONT_SIZE",
      "11pt",
    ),
  );

  const marginTop = track(
    validateMargin(process.env.PDF_MARGIN_TOP, "PDF_MARGIN_TOP", "2.5cm"),
  );
  const marginBottom = track(
    validateMargin(process.env.PDF_MARGIN_BOTTOM, "PDF_MARGIN_BOTTOM", "2.5cm"),
  );
  const marginLeft = track(
    validateMargin(process.env.PDF_MARGIN_LEFT, "PDF_MARGIN_LEFT", "2.5cm"),
  );
  const marginRight = track(
    validateMargin(process.env.PDF_MARGIN_RIGHT, "PDF_MARGIN_RIGHT", "2.5cm"),
  );
  const lineStretch = track(validateLineStretch(process.env.PDF_LINE_STRETCH));

  const timeoutMs = track(
    validatePositiveInt(
      process.env.PDF_GENERATION_TIMEOUT_MS,
      "PDF_GENERATION_TIMEOUT_MS",
      120000,
      5000,
    ),
  );
  const retries = track(
    validatePositiveInt(
      process.env.PDF_GENERATION_RETRIES,
      "PDF_GENERATION_RETRIES",
      2,
      0,
    ),
  );
  const retryDelayMs = track(
    validatePositiveInt(
      process.env.PDF_GENERATION_RETRY_DELAY_MS,
      "PDF_GENERATION_RETRY_DELAY_MS",
      1000,
      100,
    ),
  );
  const maxMarkdownBytes = track(
    validatePositiveInt(
      process.env.MAX_PDF_MARKDOWN_BYTES,
      "MAX_PDF_MARKDOWN_BYTES",
      300000,
      1000,
    ),
  );

  const colorLinksRaw = process.env.PDF_COLOR_LINKS;
  const colorLinks = colorLinksRaw !== "false";

  const linkColor = process.env.PDF_LINK_COLOR?.trim() || "teal";

  if (warnings.length > 0) {
    logger.warn(`PDF configuration warnings:\n  ${warnings.join("\n  ")}`);
  }

  return {
    engine,
    paper,
    fontSize,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    mainFont: process.env.PDF_MAIN_FONT || "Liberation Serif",
    sansFont: process.env.PDF_SANS_FONT || "Liberation Sans",
    monoFont: process.env.PDF_MONO_FONT || "Liberation Mono",
    lineStretch,
    colorLinks,
    linkColor,
    pandocPath: process.env.PANDOC_PATH || "pandoc",
    storagePath: process.env.STORAGE_PATH || "./storage/pdf",
    timeoutMs,
    retries,
    retryDelayMs,
    maxMarkdownBytes,
  };
};

/**
 * Singleton: config is read and validated once at startup.
 * Invalid values are logged as warnings and replaced
 * with defaults; the service does not crash for misconfigured env values.
 */
export const pdfConfig: PdfConfig = buildPdfConfig();
