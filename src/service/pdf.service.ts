/**
 * pdf.service.ts
 * Generazione PDF tramite XeLaTeX via Pandoc.
 * Tutta la configurazione è centralizzata in src/config/pdf.config.ts
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FieldDefinition } from "../common/types/field-definition.type";
import { pdfConfig } from "../config/pdf.config";

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
  new Promise((r) => setTimeout(r, ms));

const escapeLatexInline = (value: string): string =>
  value.replace(/[\\{}$&#_%~^]/g, (char) => `\\${char}`);

/**
 * Costruisce gli argomenti Pandoc usando pdfConfig.
 * Il motore è xelatex per default ma overridabile via PDF_ENGINE.
 */
const buildPandocArgs = (
  outputPath: string,
  title: string,
  author: string,
): string[] => [
  // raw_tex is intentionally disabled for safer server-side rendering.
  "--from",
  "markdown+smart+pipe_tables",
  "--to",
  "pdf",
  "--pdf-engine",
  pdfConfig.engine,
  "--output",
  outputPath,

  // Metadati
  `--metadata=title:${title}`,
  `--metadata=author:${author}`,
  `--metadata=lang:it`,
  `--metadata=date:${new Intl.DateTimeFormat("it-IT").format(new Date())}`,

  // Layout
  "-V",
  `papersize=${pdfConfig.paper}`,
  "-V",
  `fontsize=${pdfConfig.fontSize}`,
  "-V",
  `geometry:top=${pdfConfig.marginTop},bottom=${pdfConfig.marginBottom},left=${pdfConfig.marginLeft},right=${pdfConfig.marginRight}`,

  // Font XeLaTeX (fontspec)
  "-V",
  `mainfont=${pdfConfig.mainFont}`,
  "-V",
  `sansfont=${pdfConfig.sansFont}`,
  "-V",
  `monofont=${pdfConfig.monoFont}`,

  // Tipografia
  "-V",
  `linestretch=${pdfConfig.lineStretch}`,
  "-V",
  "indent=false",
  "-V",
  "colorlinks=true",
  "-V",
  "linkcolor=NavyBlue",
  "-V",
  "urlcolor=RoyalBlue",

  // Header/footer
  "-V",
  `header-includes=\\usepackage{fancyhdr}\\usepackage{longtable,booktabs,array}\\pagestyle{fancy}\\fancyhf{}\\fancyhead[L]{\\small ${escapeLatexInline(title)}}\\fancyhead[R]{\\small \\today}\\fancyfoot[C]{\\thepage}\\renewcommand{\\headrulewidth}{0.4pt}`,

  // Tabelle
  "-V",
  "tables=true",

  // Stdin
  "-",
];

const runPandoc = (
  args: string[],
  input: string,
  timeoutMs: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const proc = spawn(pdfConfig.pandocPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
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
      if (code === 0) resolve();
      else reject(new Error(`Pandoc exit ${code}: ${stderr.slice(0, 500)}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Pandoc non trovato (${pdfConfig.pandocPath}): ${err.message}`,
        ),
      );
    });

    proc.stdin.end(input, "utf8");
  });

// ─── Export principale ────────────────────────────────────────────────────────

const STORAGE_PATH = resolve(pdfConfig.storagePath);

export const generatePdf = async (
  markdownContent: string,
  fieldValues: Record<string, string | number | boolean | null>,
  options: PdfGenerateOptions = {},
): Promise<PdfGenerateResult> => {
  const {
    title = "Documento",
    author = "MAC Documents",
    strict = false,
  } = options;

  if (Buffer.byteLength(markdownContent, "utf8") > pdfConfig.maxMarkdownBytes) {
    throw new Error(
      `Documento troppo grande (max ${pdfConfig.maxMarkdownBytes} bytes)`,
    );
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
  for (let attempt = 0; attempt <= pdfConfig.retries; attempt++) {
    if (attempt > 0) await sleep(pdfConfig.retryDelayMs * attempt);
    try {
      await runPandoc(args, interpolated, pdfConfig.timeoutMs);
      return { filename, unresolvedFields: unresolved };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
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
