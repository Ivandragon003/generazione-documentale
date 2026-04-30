const { Module } = require('@nestjs/common');
const { AuditModule } = require('./modules/audit/audit.model');
const { TemplatesModule } = require('./modules/templates/template.module');
const { DocumentsModule } = require('./modules/documents/document.module');
const { DevModule } = require('./modules/dev/dev.module');

class AppModule {}

Module({
  imports: [AuditModule, TemplatesModule, DocumentsModule, DevModule],
})(AppModule);

module.exports = { AppModule };
