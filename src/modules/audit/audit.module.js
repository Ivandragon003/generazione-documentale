'use strict';

const { Module }          = require('@nestjs/common');
const { AuditController } = require('./audit.controller');
const { AuditService }    = require('./audit.service');

class AuditModule {}

Module({
  controllers: [AuditController],
  providers:   [AuditService],
  exports:     [AuditService],
})(AuditModule);

module.exports = { AuditModule };
