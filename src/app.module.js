'use strict';

const { Module } = require('@nestjs/common');
const { HealthModule }    = require('./modules/health/health.module');
const { AuditModule }     = require('./modules/audit/audit.module');
const { TemplatesModule } = require('./modules/templates/template.module');
const { DocumentsModule } = require('./modules/documents/document.module');

// DevModule registrato solo in sviluppo:
// - le route /api/dev/* non esistono in produzione
// - la sezione "dev" sparisce completamente dallo Swagger
const devImports = process.env.NODE_ENV !== 'production'
  ? [require('./modules/dev/dev.module').DevModule]
  : [];

class AppModule {}

Module({
  imports: [HealthModule, AuditModule, TemplatesModule, DocumentsModule, ...devImports],
})(AppModule);

module.exports = { AppModule };
