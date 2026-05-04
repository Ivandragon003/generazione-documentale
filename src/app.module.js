'use strict';

const { Module } = require('@nestjs/common');
const { HealthModule }    = require('./modules/health/health.module');
const { TemplatesModule } = require('./modules/templates/template.module');
const { DocumentsModule } = require('./modules/documents/document.module');

// AuditModule rimosso: non aveva route proprie.
// AuditService viene importato direttamente da TemplatesModule e DocumentsModule.
// DevModule non registrato: i test girano automaticamente all'avvio (solo development).
class AppModule {}

Module({
  imports: [HealthModule, TemplatesModule, DocumentsModule],
})(AppModule);

module.exports = { AppModule };
