const { Module } = require('@nestjs/common');
const { DocumentsController } = require('./documents.controller');
const { DocumentsService } = require('./documents.service');
const { PdfController } = require('./pdf.controller');
const { AuditService } = require('../audit/audit.service');
const { TemplatesService } = require('../templates/templates.service');
const { TemplatesModule } = require('../templates/templates.module');

class DocumentsModule {}

Module({
  imports: [TemplatesModule],
  controllers: [DocumentsController, PdfController],
  providers: [
    AuditService,
    {
      provide: DocumentsService,
      useFactory: (auditService, templatesService) =>
        new DocumentsService(auditService, templatesService),
      inject: [AuditService, TemplatesService],
    },
    {
      provide: PdfController,
      useFactory: (templatesService) => new PdfController(templatesService),
      inject: [TemplatesService],
    },
  ],
})(DocumentsModule);

module.exports = { DocumentsModule };