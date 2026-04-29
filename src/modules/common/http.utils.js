const fs = require('fs');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function wrapAsync(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

function validateUuidParam(paramName, errorMessage) {
  return (req, res, next, value) => {
    if (!UUID_RE.test(value)) {
      return res.status(400).json({ error: errorMessage || `${paramName} non valido` });
    }
    next();
  };
}

function getActor(req) {
  return req.headers['x-user'] || 'system';
}

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

module.exports = {
  wrapAsync,
  validateUuidParam,
  getActor,
  readAndCleanupUpload,
};
