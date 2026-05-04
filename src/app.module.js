'use strict';

const { Module } = require('@nestjs/common');
const { HealthModule }    = require('./modules/health/health.module');
const { AuditModule }     = require('./modules/audit/audit.module');
const { TemplatesModule } = require('./modules/templates/template.module');
const { DocumentsModule } = require('./modules/documents/document.module');

// DevModule NON viene mai registrato:
// - le route /api/dev/* non esistono né in Swagger né nel server
// - i test vengono eseguiti automaticamente all'avvio da main.js (solo in development)
class AppModule {}

Module({
  imports: [HealthModule, AuditModule, TemplatesModule, DocumentsModule],
})(AppModule);

module.exports = { AppModule };
