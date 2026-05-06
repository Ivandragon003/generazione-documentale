/**
 * pdf.service.ts
 * Generazione PDF tramite XeLaTeX via Pandoc.
 *
 * XeLaTeX offre:
 * - Supporto nativo Unicode e font di sistema (fontspec)
 * - Migliore gestione caratteri italiani (àèìòù) senza encoding magic
 * - Supporto OpenType / TrueType completo
 * - Tabelle e immagini più stabili
 *
 * Requisiti sistema:
 *   - pandoc >= 3.x  (PANDOC_PATH, default: pandoc)
 *   - xelatex        (da TeX Live o MiKTeX)
 *
 * Variabili .env:
 *   PANDOC_PATH                  percorso binario pandoc
 *   STORAGE_PATH                 cartella output PDF
 *   PDF_GENERATION_TIMEOUT_MS    timeout job (default 120000)
 *   PDF_GENERATION_RETRIES       tentativi in caso di errore (default 2)
 *   PDF_GENERATION_RETRY_DELAY_MS delay tra tentativi (default 1000)
 *   MAX_PDF_MARKDOWN_BYTES       dimensione max input markdown (default 300000)
 *   PDF_PAPER                    formato carta: a4, letter (default a4)
 *   PDF_FONT_SIZE                dimensione font: 10pt,11pt,12pt (default 11pt)
 *   PDF_MARGIN_TOP               margine superiore (default 2.5cm)
 *   PDF_MARGIN_BOTTOM            margine inferiore (default 2.5cm)
 *   PDF_MARGIN_LEFT              margine sinistro (default 2.5cm)
 *   PDF_MARGIN_RIGHT             margine destro (default 2.5cm)
 *   PDF_MAIN_FONT                font corpo testo (default Liberation Serif)
 *   PDF_SANS_FONT                font titoli/sans (default Liberation Sans)
 *   PDF_MONO_FONT                font monospace (default Liberation Mono)
 */

import { createReadStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { FieldDefinition } from "../common/types/field-definition.type";

// ─── Configurazione ──────────────────────────────────────────────────────────

const PANDOC_PATH = process.env.PANDOC_PATH ?? "pandoc";
const STORAGE_PATH = resolve(process.env.STORAGE_PATH ?? "./storage/pdf");
const TIMEOUT_MS = Math.max(
  Number.parseInt(process.env.PDF_GENERATION_TIMEOUT_MS ?? "120000", 10),
  5000,
);
const RETRIES = Math.max(
  Number.parseInt(process.env.PDF_GENERATION_RETRIES ?? "2", 10),
  0,
);
const RETRY_DELAY_MS = Math.max(
  Number.parseInt(process.env.PDF_GENERATION_RETRY_DELAY_MS ?? "1000", 10),
  100,
);
const MAX_MARKDOWN_BYTES = Math.max(
  Number.parseInt(process.env.MAX_PDF_MARKDOWN_BYTES ?? "300000", 10),
  1000,
);

// Layout / tipografia
const PAPER = process.env.PDF_PAPER ?? "a4";
const FONT_SIZE = process.env.PDF_FONT_SIZE ?? "11pt";
const MARGIN_TOP = process.env.PDF_MARGIN_TOP ?? "2.5cm";
const MARGIN_BOTTOM = process.env.PDF_MARGIN_BOTTOM ?? "2.5cm";
const MARGIN_LEFT = process.env.PDF_MARGIN_LEFT ?? "2.5cm";
const MARGIN_RIGHT = process.env.PDF_MARGIN_RIGHT ?? "2.5cm";
const MAIN_FONT = process.env.PDF_MAIN_FONT ?? "Liberation Serif";
const SANS_FONT = process.env.PDF_SANS_FONT ?? "Liberation Sans";
const MONO_FONT = process.env.PDF_MONO_FONT ?? "Liberation Mono";

// ─── Tipi ────────────────────────────────────────────────────────────────────

export interface PdfGenerateOptions {
  title?: string;
  author?: string;
  strict?: boolean;
  fields?: FieldDefinition[];
}

export interface PdfGenerateResult {
  filename: string;
  unresolvedFields: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sostituisce {{campo}} con il valore corrispondente.
 * In modalità strict lascia i segnaposto non compilati come stringa vuota.
 */
const interpolateFields = (
  content: string,
  fieldValues: Record<string, string | number | boolean | null>,
  strict: boolean,
): { result: string; unresolved: string[] } => {
  const unresolved: string[] = [];
  const result = content.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const k = key.trim();
    const val = fieldValues[k];
    if (val === undefined || val === null || val === "") {
      unresolved.push(k);
      return strict ? "" : match;
    }
    return String(val);
  });
  return { result, unresolved };
};

export const getMissingRequiredFields = (
  fields: FieldDefinition[],
  fieldValues: Record<string, string | number | boolean | null>,
): string[] =>
  fields
    .filter(
      (f) =>
        f.required !== false &&
        (fieldValues[f.name] === undefined ||
          fieldValues[f.name] === null ||
          fieldValues[f.name] === ""),
    )
    .map((f) => f.label ?? f.name);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Costruisce gli argomenti Pandoc per XeLaTeX con layout professionale.
 */
const buildPandocArgs = (outputPath: string, title: string, author: string): string[] => [
  "--from", "markdown+smart+pipe_tables+raw_tex",
  "--to", "pdf",
  "--pdf-engine", "xelatex",
  "--output", outputPath,

  // Metadati documento
  `--metadata=title:${title}`,
  `--metadata=author:${author}`,
  `--metadata=lang:it`,
  `--metadata=date:${new Date().toLocaleDateString("it-IT")}`,

  // Layout pagina
  `-V`, `papersize=${PAPER}`,
  `-V`, `fontsize=${FONT_SIZE}`,
  `-V`, `geometry:top=${MARGIN_TOP},bottom=${MARGIN_BOTTOM},left=${MARGIN_LEFT},right=${MARGIN_RIGHT}`,

  // Font XeLaTeX (fontspec)
  `-V`, `mainfont=${MAIN_FONT}`,
  `-V`, `sansfont=${SANS_FONT}`,
  `-V`, `monofont=${MONO_FONT}`,

  // Tipografia
  `-V`, `linestretch=1.25`,
  `-V`, `indent=false`,
  `-V`, `colorlinks=true`,
  `-V`, `linkcolor=NavyBlue`,
  `-V`, `urlcolor=RoyalBlue`,

  // Intestazione/piè di pagina con fancyhdr
  `-V`, `header-includes=\\usepackage{fancyhdr}\\pagestyle{fancy}\\fancyhf{}\\fancyhead[L]{\\small ${title}}\\fancyhead[R]{\\small \\today}\\fancyfoot[C]{\\thepage}\\renewcommand{\\headrulewidth}{0.4pt}`,

  // Tabelle longtable per gestire tabelle su più pagine
  `-V`, `tables=true`,
  "--variable", "header-includes=\\usepackage{longtable,booktabs,array}",

  // Sezione numerazione
  `-V`, `numbersections=false`,

  // Lettura da stdin
  "-",
];

/**
 * Esegue Pandoc con XeLaTeX con timeout e retry.
 */
const runPandoc = (
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn(PANDOC_PATH, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
      reject(new Error(`Pandoc timeout dopo ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) return;
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Pandoc exit ${code}: ${stderr.slice(0, 500)}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Pandoc non trovato o non eseguibile: ${err.message}`));
    });

    proc.stdin.end(input, "utf8");
  });

// ─── Export principale ────────────────────────────────────────────────────────

export const generatePdf = async (
  markdownContent: string,
  fieldValues: Record<string, string | number | boolean | null>,
  options: PdfGenerateOptions = {},
): Promise<PdfGenerateResult> => {
  const { title = "Documento", author = "MAC Documents", strict = false, fields = [] } = options;

  if (Buffer.byteLength(markdownContent, "utf8") > MAX_MARKDOWN_BYTES) {
    throw new Error(`Documento troppo grande (max ${MAX_MARKDOWN_BYTES} bytes)`);
  }

  const { result: interpolated, unresolved } = interpolateFields(
    markdownContent,
    fieldValues,
    strict,
  );

  await mkdir(STORAGE_PATH, { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  const outputPath = join(STORAGE_PATH, filename);
  const args = buildPandocArgs(outputPath, title, author);

  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
    try {
      await runPandoc(args, interpolated, TIMEOUT_MS);
      return { filename, unresolvedFields: unresolved };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < RETRIES) continue;
    }
  }
  throw lastError ?? new Error("Errore generazione PDF");
};

export const getPdfStream = async (filename: string) => {
  const filepath = join(STORAGE_PATH, filename);
  try {
    await access(filepath);
  } catch {
    throw new Error(`File PDF non trovato: ${filename}`);
  }
  return createReadStream(filepath);
};

export const deletePdf = async (filename: string): Promise<void> => {
  const filepath = join(STORAGE_PATH, filename);
  await unlink(filepath).catch(() => undefined);
};
