const { Module } = require('@nestjs/common');
const { AuditController } = require('./audit.controller');
const { AuditService } = require('./audit.service');

class AuditModule {}

Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: AuditController,
      useFactory: (auditService) => new AuditController(auditService),
      inject: [AuditService],
    },
  ],
  exports: [AuditService],
})(AuditModule);

module.exports = { AuditModule };