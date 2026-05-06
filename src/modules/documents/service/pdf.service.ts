import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, constants as fsConstants } from "node:fs";
import { access, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import type { FieldDefinition } from "../../../common/types/field-definition.type";

const execFileAsync = promisify(execFile);

const STORAGE_PATH = process.env.STORAGE_PATH ?? "./storage/pdf";
const PANDOC_PATH = process.env.PANDOC_PATH ?? "pandoc";
const PANDOC_PDF_ENGINE = process.env.PANDOC_PDF_ENGINE ?? "pdflatex";
const PDF_GENERATION_RETRIES = Math.max(
  Number.parseInt(process.env.PDF_GENERATION_RETRIES ?? "2", 10),
  0,
);
const PDF_GENERATION_RETRY_DELAY = Math.max(
  Number.parseInt(process.env.PDF_GENERATION_RETRY_DELAY_MS ?? "500", 10),
  0,
);
const PDF_GENERATION_TIMEOUT = Math.max(
  Number.parseInt(process.env.PDF_GENERATION_TIMEOUT_MS ?? "60000", 10),
  5000,
);
const MAX_PDF_MARKDOWN_BYTES = Math.max(
  Number.parseInt(process.env.MAX_PDF_MARKDOWN_BYTES ?? "300000", 10),
  1000,
);

export interface PdfGenerateOptions {
  title?: string;
  strict?: boolean;
  fields?: FieldDefinition[];
}

const normalizeFieldDefinitions = (
  fields: FieldDefinition[] = [],
): FieldDefinition[] => {
  return (Array.isArray(fields) ? fields : []).filter((field) => field?.name);
};

export const resolvePlaceholders = (
  content: string,
  fieldValues: Record<string, string | number | boolean | null>,
  fields: FieldDefinition[] = [],
): string => {
  const definitions = normalizeFieldDefinitions(fields);
  const byName = new Map(definitions.map((field) => [field.name, field]));

  return content.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
    const value = fieldValues[key];
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }

    const definition = byName.get(key);
    if (definition?.defaultValue) {
      return definition.defaultValue;
    }

    if (definition?.required === false) {
      return "";
    }

    return placeholder;
  });
};

export const getMissingRequiredFields = (
  fields: FieldDefinition[],
  fieldValues: Record<string, string | number | boolean | null>,
): string[] => {
  return normalizeFieldDefinitions(fields)
    .filter((field) => field.required !== false)
    .filter((field) => {
      const value = fieldValues[field.name];
      return value === undefined || value === null || value === "";
    })
    .map((field) => field.name);
};

export const getUnresolvedPlaceholders = (content: string): string[] => {
  const unresolved: string[] = [];
  for (const match of content.matchAll(/\{\{(\w+)\}\}/g)) {
    if (match[1]) {
      unresolved.push(match[1]);
    }
  }
  return unresolved;
};

const ensureStorageDir = async (): Promise<void> => {
  await mkdir(STORAGE_PATH, { recursive: true });
};

const sleep = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const runPandocWithRetry = async (args: string[]): Promise<void> => {
  const maxAttempts = PDF_GENERATION_RETRIES + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await execFileAsync(PANDOC_PATH, args, {
        timeout: PDF_GENERATION_TIMEOUT,
        killSignal: "SIGKILL",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(PDF_GENERATION_RETRY_DELAY);
      }
    }
  }

  if (
    lastError &&
    typeof lastError === "object" &&
    "code" in lastError &&
    lastError.code === "ENOENT"
  ) {
    throw new Error(
      `Pandoc non disponibile per Node. Configura PANDOC_PATH in .env oppure aggiungi Pandoc al PATH. Comando provato: ${PANDOC_PATH}`,
    );
  }

  if (
    lastError &&
    typeof lastError === "object" &&
    "stderr" in lastError &&
    typeof lastError.stderr === "string"
  ) {
    throw new Error(lastError.stderr.trim());
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Errore generazione PDF");
};

export const generatePdf = async (
  content: string,
  fieldValues: Record<string, string | number | boolean | null> = {},
  options: PdfGenerateOptions = {},
): Promise<{ filename: string; path: string; unresolvedFields: string[] }> => {
  await ensureStorageDir();

  if (Buffer.byteLength(content, "utf8") > MAX_PDF_MARKDOWN_BYTES) {
    throw new Error(
      `Documento troppo grande per PDF. Limite: ${MAX_PDF_MARKDOWN_BYTES} byte`,
    );
  }

  const fields = normalizeFieldDefinitions(options.fields ?? []);
  const missingRequired = getMissingRequiredFields(fields, fieldValues);
  if (options.strict && missingRequired.length > 0) {
    throw new Error(
      `Campi obbligatori non compilati: ${missingRequired.join(", ")}`,
    );
  }

  const resolvedContent = resolvePlaceholders(content, fieldValues, fields);
  const unresolvedFields = getUnresolvedPlaceholders(resolvedContent);
  if (options.strict && unresolvedFields.length > 0) {
    throw new Error(
      `Campi obbligatori non compilati: ${unresolvedFields.join(", ")}`,
    );
  }

  const filename = `${randomUUID()}.pdf`;
  const outputPath = join(STORAGE_PATH, filename);
  const tmpDir = join(STORAGE_PATH, `job-${randomUUID()}`);
  const tmpMarkdownFile = join(tmpDir, "input.md");

  try {
    await mkdir(tmpDir, { recursive: true });
    await writeFile(tmpMarkdownFile, resolvedContent, "utf8");

    await runPandocWithRetry([
      tmpMarkdownFile,
      "-o",
      outputPath,
      "--standalone",
      "-V",
      "geometry:margin=2.5cm",
      "-V",
      "lang=it",
      "--pdf-engine",
      PANDOC_PDF_ENGINE,
      "--metadata",
      `title=${options.title ?? "Documento"}`,
    ]);

    return {
      filename,
      path: outputPath,
      unresolvedFields,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
};

export const deletePdf = async (filename: string): Promise<void> => {
  const filePath = join(STORAGE_PATH, basename(filename));
  await unlink(filePath).catch(() => undefined);
};

export const getPdfStream = async (filename: string) => {
  const filePath = join(STORAGE_PATH, basename(filename));
  try {
    await access(filePath, fsConstants.R_OK);
  } catch {
    throw new Error("File PDF non trovato");
  }

  return createReadStream(filePath);
};
