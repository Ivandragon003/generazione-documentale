'use strict';

const { Controller } = require('@nestjs/common');
const { ApiTags }   = require('@nestjs/swagger');

// Il registro audit globale è stato rimosso.
// L'audit è accessibile contestualmente:
//   GET /api/templates/:id/audit  → TemplatesController
//   GET /api/documents/:id/audit  → DocumentsController

class AuditController {}

ApiTags('audit')(AuditController);
Controller('audit')(AuditController);

module.exports = { AuditController };
