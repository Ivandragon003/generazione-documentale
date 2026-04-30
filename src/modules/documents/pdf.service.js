const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const execFileAsync = promisify(execFile);
const fsp = fs.promises;

const STORAGE_PATH               = process.env.STORAGE_PATH               || './storage/pdf';
const PANDOC_PATH                = process.env.PANDOC_PATH                || 'pandoc';
const PANDOC_PDF_ENGINE          = process.env.PANDOC_PDF_ENGINE          || 'pdflatex';
const PDF_GENERATION_RETRIES     = Math.max(parseInt(process.env.PDF_GENERATION_RETRIES     || '2',     10), 0);
const PDF_GENERATION_RETRY_DELAY = Math.max(parseInt(process.env.PDF_GENERATION_RETRY_DELAY_MS || '500', 10), 0);
const PDF_GENERATION_TIMEOUT     = Math.max(parseInt(process.env.PDF_GENERATION_TIMEOUT_MS  || '60000',10), 5000);
const MAX_PDF_MARKDOWN_BYTES     = Math.max(parseInt(process.env.MAX_PDF_MARKDOWN_BYTES     || '300000',10), 1000);

function normalizeFieldDefinitions(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((f) => (typeof f === 'string' ? { name: f, required: true } : f))
    .filter((f) => f && f.name);
}

function resolvePlaceholders(content, fieldValues, fields = []) {
  const definitions = normalizeFieldDefinitions(fields);
  const byName = new Map(definitions.map((f) => [f.name, f]));

  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (fieldValues[key] !== undefined && fieldValues[key] !== null && fieldValues[key] !== '') {
      return fieldValues[key];
    }
    const def = byName.get(key);
    if (def && def.defaultValue !== undefined && def.defaultValue !== '') return def.defaultValue;
    if (def && def.required === false) return '';
    return match;
  });
}

function getMissingRequiredFields(fields, fieldValues) {
  return normalizeFieldDefinitions(fields)
    .filter((f) => f.required !== false)
    .filter((f) => fieldValues[f.name] === undefined || fieldValues[f.name] === null || fieldValues[f.name] === '')
    .map((f) => f.name);
}

function getUnresolvedPlaceholders(content) {
  const regex = /\{\{(\w+)\}\}/g;
  const unresolved = [];
  let match;
  while ((match = regex.exec(content)) !== null) unresolved.push(match[1]);
  return unresolved;
}

async function ensureStorageDir() {
  await fsp.mkdir(STORAGE_PATH, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPandocWithRetry(args) {
  let lastError;
  const maxAttempts = PDF_GENERATION_RETRIES + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await execFileAsync(PANDOC_PATH, args, {
        timeout: PDF_GENERATION_TIMEOUT,
        killSignal: 'SIGKILL',
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      });
      return;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) await sleep(PDF_GENERATION_RETRY_DELAY);
    }
  }

  if (lastError && lastError.code === 'ENOENT') {
    throw new Error(
      `Pandoc non disponibile per Node. Configura PANDOC_PATH in .env oppure aggiungi Pandoc al PATH. Comando provato: ${PANDOC_PATH}`,
    );
  }
  if (lastError && lastError.stderr) throw new Error(lastError.stderr.trim());
  throw lastError;
}

async function generatePdf(content, fieldValues = {}, options = {}) {
  await ensureStorageDir();

  if (Buffer.byteLength(content, 'utf8') > MAX_PDF_MARKDOWN_BYTES) {
    throw new Error(`Documento troppo grande per PDF. Limite: ${MAX_PDF_MARKDOWN_BYTES} byte`);
  }

  const fields = normalizeFieldDefinitions(options.fields || []);
  const missingRequired = getMissingRequiredFields(fields, fieldValues);

  if (options.strict && missingRequired.length > 0) {
    throw new Error(`Campi obbligatori non compilati: ${missingRequired.join(', ')}`);
  }

  const resolvedContent = resolvePlaceholders(content, fieldValues, fields);
  const unresolved = getUnresolvedPlaceholders(resolvedContent);

  if (options.strict && unresolved.length > 0) {
    throw new Error(`Campi obbligatori non compilati: ${unresolved.join(', ')}`);
  }

  const filename = `${uuidv4()}.pdf`;
  const outputPath = path.join(STORAGE_PATH, filename);
  const tmpDir = path.join(STORAGE_PATH, `job-${uuidv4()}`);
  const tmpMd = path.join(tmpDir, 'input.md');

  try {
    await fsp.mkdir(tmpDir, { recursive: true });
    await fsp.writeFile(tmpMd, resolvedContent, 'utf8');
    await runPandocWithRetry([
      tmpMd, '-o', outputPath,
      '--standalone',
      '-V', 'geometry:margin=2.5cm',
      '-V', 'lang=it',
      '--pdf-engine', PANDOC_PDF_ENGINE,
      '--metadata', `title=${options.title || 'Documento'}`,
    ]);
    return { filename, path: outputPath, unresolvedFields: unresolved };
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function deletePdf(filename) {
  if (!filename) return;
  const filePath = path.join(STORAGE_PATH, path.basename(filename));
  await fsp.unlink(filePath).catch(() => {});
}

async function getPdfStream(filename) {
  const filePath = path.join(STORAGE_PATH, path.basename(filename));
  try {
    await fsp.access(filePath, fs.constants.R_OK);
    return fs.createReadStream(filePath);
  } catch {
    throw new Error('File PDF non trovato');
  }
}

module.exports = {
  generatePdf,
  deletePdf,
  getPdfStream,
  resolvePlaceholders,
  getUnresolvedPlaceholders,
  getMissingRequiredFields,
};