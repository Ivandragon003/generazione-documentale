'use strict';

const { Module } = require('@nestjs/common');
const { DocumentsController } = require('./documents.controller');
const { DocumentsService }    = require('./documents.service');
const { PdfController }       = require('./pdf.controller');
const { AuditService }        = require('../audit/audit.service');
const { TemplatesModule }     = require('../templates/template.module');
const { TemplatesService }    = require('../templates/templates.service');

class DocumentsModule {}

Module({
  imports:     [TemplatesModule],
  controllers: [DocumentsController, PdfController],
  providers: [
    AuditService,
    {
      provide: DocumentsService,
      useFactory: (auditService, templatesService) =>
        new DocumentsService(auditService, templatesService),
      inject: [AuditService, TemplatesService],
    },
  ],
})(DocumentsModule);

module.exports = { DocumentsModule };