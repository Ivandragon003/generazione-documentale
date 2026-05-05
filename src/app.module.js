'use strict';

const { Module } = require('@nestjs/common');
const { HealthModule }    = require('./modules/health/health.module');
const { TemplatesModule } = require('./modules/templates/template.module');
const { DocumentsModule } = require('./modules/documents/document.module');
const { DevModule }       = require('./modules/dev/dev.module');

class AppModule {}

Module({
  imports: [HealthModule, TemplatesModule, DocumentsModule, DevModule],
})(AppModule);

module.exports = { AppModule };
