'use strict';

const fs = require('fs');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getActor(req) {
  return (req && req.headers && req.headers['x-user']) || 'system';
}

function readAndCleanupUpload(file) {
  let content;
  try {
    content = fs.readFileSync(file.path, 'utf8');
  } finally {
    try { fs.unlinkSync(file.path); } catch (_) {}
  }
  return content;
}

function isValidUuid(value) {
  return UUID_RE.test(value);
}

function parsePagination(query, defaults = { limit: 20, offset: 0 }) {
  const limit  = query.limit  === undefined ? defaults.limit  : Number.parseInt(query.limit,  10);
  const offset = query.offset === undefined ? defaults.offset : Number.parseInt(query.offset, 10);
  if (!Number.isInteger(limit)  || limit  <= 0) throw { status: 400, message: 'limit non valido' };
  if (!Number.isInteger(offset) || offset < 0)  throw { status: 400, message: 'offset non valido' };
  return { limit, offset };
}

function parseVersionOrThrow(value) {
  const parsed = Number.parseInt(value, 10);
  if (!/^\d+$/.test(String(value)) || parsed <= 0) {
    throw { status: 400, message: 'version non valida' };
  }
  return parsed;
}

/**
 * Wrappa una funzione async express per propagare gli errori al next() di Express.
 * Usato nei controller dev/reset che non usano NestJS exception filters.
 */
function wrapAsync(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  getActor,
  readAndCleanupUpload,
  isValidUuid,
  parsePagination,
  parseVersionOrThrow,
  wrapAsync,
};