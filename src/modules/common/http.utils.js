const fs = require('fs');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Estrae l'attore dalla request (header x-user oppure 'system').
 */
function getActor(req) {
  return req.headers['x-user'] || 'system';
}

/**
 * Legge il file temporaneo caricato da multer, lo elimina e restituisce il contenuto.
 */
function readAndCleanupUpload(file) {
  let content;
  try {
    content = fs.readFileSync(file.path, 'utf8');
  } finally {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {}
  }
  return content;
}

/**
 * Verifica che una stringa sia un UUID v1-v5 valido.
 */
function isValidUuid(value) {
  return UUID_RE.test(value);
}

/**
 * Parsa e valida i parametri di paginazione dalla query string.
 * Lancia un oggetto { status, message } compatibile con HttpException in caso di errore.
 */
function parsePagination(query, defaults = { limit: 20, offset: 0 }) {
  const limit =
    query.limit === undefined
      ? defaults.limit
      : Number.parseInt(query.limit, 10);
  const offset =
    query.offset === undefined
      ? defaults.offset
      : Number.parseInt(query.offset, 10);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw { status: 400, message: 'limit non valido' };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw { status: 400, message: 'offset non valido' };
  }
  return { limit, offset };
}

/**
 * Parsa un parametro versione intero positivo.
 * Lancia un oggetto { status, message } in caso di valore non valido.
 */
function parseVersionOrThrow(value) {
  const parsed = Number.parseInt(value, 10);
  if (!/^\d+$/.test(String(value)) || parsed <= 0) {
    throw { status: 400, message: 'version non valida' };
  }
  return parsed;
}

module.exports = {
  getActor,
  readAndCleanupUpload,
  isValidUuid,
  parsePagination,
  parseVersionOrThrow,
};