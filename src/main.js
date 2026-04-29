require('dotenv').config();
const express = require('express');

const { registerTemplateRoutes } = require('./modules/templates/templates.controller');
const { registerDocumentRoutes } = require('./modules/documents/documents.controller');
const { registerPdfRoutes } = require('./modules/documents/pdf.controller');
const { registerAuditRoutes } = require('./modules/audit/audit.controller');
const { registerDevRoutes } = require('./modules/dev/reset.controller');
const { getPool } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging minimo
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/templates', registerTemplateRoutes(express.Router()));
app.use('/api/documents', registerDocumentRoutes(express.Router()));
app.use('/api/pdf', registerPdfRoutes(express.Router()));
app.use('/api/audit', registerAuditRoutes(express.Router()));
app.use('/api/dev', registerDevRoutes(express.Router()));

// Health check
app.get('/health', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', message: err.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trovata', path: req.path });
});

// Error handler centralizzato
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Errore interno del server';

  // Non loggare stack in produzione
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  }

  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`MAC Documents API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
