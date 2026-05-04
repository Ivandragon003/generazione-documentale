'use strict';

// Il registro audit globale non esiste come endpoint separato.
// L'audit è accessibile contestualmente via:
//   GET /api/templates/:id/audit  → TemplatesController
//   GET /api/documents/:id/audit  → DocumentsController
// Non serve un AuditController: rimuovendolo la sezione "audit" sparisce dallo Swagger.

module.exports = {};
