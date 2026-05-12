/**
 * pdf.config.ts
 *
 * Layer di configurazione centralizzato per la generazione PDF.
 * Tutte le variabili env vengono lette, validate e normalizzate qui.
 * Il service non legge mai process.env direttamente.
 *
 * Variabili supportate:
 *   PDF_ENGINE           motore pandoc (default: xelatex) — override per debug/test
 *   PDF_PAPER            formato carta: a4, letter, a3 (default: a4)
 *   PDF_FONT_SIZE        dimensione font: 10pt, 11pt, 12pt (default: 11pt)
 *   PDF_MARGIN_TOP       margine superiore (default: 2.5cm)
 *   PDF_MARGIN_BOTTOM    margine inferiore (default: 2.5cm)
 *   PDF_MARGIN_LEFT      margine sinistro (default: 2.5cm)
 *   PDF_MARGIN_RIGHT     margine destro (default: 2.5cm)
 *   PDF_MAIN_FONT        font corpo (default: Liberation Serif)
 *   PDF_SANS_FONT        font sans (default: Liberation Sans)
 *   PDF_MONO_FONT        font mono (default: Liberation Mono)
 *   PDF_LINE_STRETCH     interlinea 1.0–2.0 (default: 1.25)
 *   PDF_COLOR_LINKS      abilita link colorati: true|false (default: true)
 *   PDF_LINK_COLOR       colore link pandoc (default: teal)
 *   PANDOC_PATH          percorso binario pandoc (default: pandoc)
 *   STORAGE_PATH         cartella output PDF (default: ./storage/pdf)
 *   PDF_GENERATION_TIMEOUT_MS   timeout job (default: 120000)
 *   PDF_GENERATION_RETRIES      tentativi retry (default: 2)
 *   PDF_GENERATION_RETRY_DELAY_MS delay retry (default: 1000)
 *   MAX_PDF_MARKDOWN_BYTES      limite dimensione input (default: 300000)
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

// ─── Validatori ──────────────────────────────────────────────────────────

const ALLOWED_ENGINES = ["xelatex", "lualatex", "pdflatex"] as const;
const ALLOWED_PAPERS = ["a4", "a3", "a5", "letter", "legal"] as const;
const ALLOWED_FONT_SIZES = ["9pt", "10pt", "11pt", "12pt", "14pt"] as const;
const MARGIN_PATTERN = /^\d+(\.\d+)?(cm|mm|in|pt|em)$/;
const LINE_STRETCH_MIN = 1;
const LINE_STRETCH_MAX = 2;

type ValidationError = string;

const validateEnum = <T extends string>(
  value: string,
  allowed: readonly T[],
  varName: string,
  fallback: T,
): { value: T; error?: ValidationError } => {
  if ((allowed as readonly string[]).includes(value)) {
    return { value: value as T };
  }
  return {
    value: fallback,
    error: `${varName}="${value}" non valido (accettati: ${allowed.join(", ")}), uso default "${fallback}"`,
  };
};

const validateMargin = (
  raw: string | undefined,
  varName: string,
  fallback: string,
): { value: string; error?: ValidationError } => {
  const v = raw?.trim() ?? fallback;
  if (MARGIN_PATTERN.test(v)) return { value: v };
  return {
    value: fallback,
    error: `${varName}="${v}" non valido (es: 2.5cm, 20mm, 1in), uso default "${fallback}"`,
  };
};

const validatePositiveInt = (
  raw: string | undefined,
  varName: string,
  fallback: number,
  min = 1,
): { value: number; error?: ValidationError } => {
  const parsed = Math.round(Number.parseFloat(raw ?? ""));
  if (Number.isInteger(parsed) && parsed >= min) return { value: parsed };
  return {
    value: fallback,
    error: `${varName}="${raw}" non valido (intero >= ${min}), uso default ${fallback}`,
  };
};

const validateLineStretch = (
  raw: string | undefined,
): { value: number; error?: ValidationError } => {
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
    error: `PDF_LINE_STRETCH="${raw}" non valido (1.0–2.0), uso default 1.25`,
  };
};

// ─── Builder ───────────────────────────────────────────────────────────────────

const buildPdfConfig = (): PdfConfig => {
  const logger = new Logger("pdf.config");
  const warnings: ValidationError[] = [];

  const track = <T>(result: { value: T; error?: ValidationError }): T => {
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
    logger.warn(
      `Avvisi configurazione PDF:\n${warnings.map((w) => `  ${w}`).join("\n")}`,
    );
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
 * Singleton: la config viene letta e validata una sola volta all'avvio.
 * Eventuali valori invalidi vengono loggati come warning e sostituiti
 * con i default — il servizio non crasha mai per una env mal configurata.
 */
export const pdfConfig: PdfConfig = buildPdfConfig();
