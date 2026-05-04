'use strict';

const { Module }       = require('@nestjs/common');
const { AuditService } = require('./audit.service');

// AuditController rimosso: nessuna route /api/audit/* da esporre.
// AuditService rimane disponibile per gli altri moduli (templates, documents).
class AuditModule {}

Module({
  controllers: [],
  providers:   [AuditService],
  exports:     [AuditService],
})(AuditModule);

module.exports = { AuditModule };
