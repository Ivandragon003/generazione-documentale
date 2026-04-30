'use strict';

const { Controller, Get, Query, HttpException } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiQuery }       = require('@nestjs/swagger');
const { AuditService }    = require('./audit.service');
const { parsePagination } = require('../common/http.utils');

function throwHttp(err) {
  throw new HttpException(err.message || 'Errore interno', err.status || 500);
}

class AuditController {
  constructor(auditService) {
    this.auditService = auditService;
  }

  async findAll(query) {
    let pagination;
    try {
      pagination = parsePagination(query, { limit: 50, offset: 0 });
    } catch (e) {
      throwHttp(e);
    }
    const { entityType, actor, fromDate, toDate } = query;
    return this.auditService.findAll({ entityType, actor, fromDate, toDate, ...pagination });
  }
}

// DI: dice a NestJS cosa iniettare nel costruttore
Reflect.defineMetadata('design:paramtypes', [AuditService], AuditController);

ApiTags('audit')(AuditController);
Controller('audit')(AuditController);

const proto = AuditController.prototype;

Get()(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiOperation({ summary: 'Registro audit globale' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'entityType', required: false, enum: ['template', 'document'] })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'actor',    required: false, type: String })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'fromDate', required: false, description: 'ISO 8601 datetime' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'toDate',   required: false, description: 'ISO 8601 datetime' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'limit',    required: false, type: Number, example: 50 })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'offset',   required: false, type: Number, example: 0  })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'findAll');
Query()(proto, 'findAll', 0);

module.exports = { AuditController };
