const { Module } = require('@nestjs/common');
const { TemplatesController } = require('./templates.controller');
const { TemplatesService } = require('./templates.service');
const { AuditService } = require('../audit/audit.service');

class TemplatesModule {}

Module({
  controllers: [TemplatesController],
  providers: [
    TemplatesService,
    AuditService,
    {
      // Iniezione manuale: TemplatesService riceve AuditService nel costruttore
      provide: TemplatesService,
      useFactory: (auditService) => new TemplatesService(auditService),
      inject: [AuditService],
    },
  ],
  exports: [TemplatesService],
})(TemplatesModule);

module.exports = { TemplatesModule };