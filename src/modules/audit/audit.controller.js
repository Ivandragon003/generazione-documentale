'use strict';

const {
  Controller, Get, Query, HttpException, Inject,
} = require('@nestjs/common');
const {
  ApiTags, ApiOperation, ApiQuery,
} = require('@nestjs/swagger');

const { AuditService } = require('./audit.service');
const { parsePagination } = require('../common/http.utils');

function throwHttp(err) {
  throw new HttpException(err.message || 'Errore interno', err.status || 500);
}

class AuditController {
  constructor(auditService) {
    this.auditService = auditService;
  }

  async findAll(query) {
    try {
      const { limit, offset } = parsePagination(query, { limit: 50, offset: 0 });
      return this.auditService.findAll({
        entityType: query.entityType,
        actor:      query.actor,
        fromDate:   query.fromDate,
        toDate:     query.toDate,
        limit,
        offset,
      });
    } catch (e) { throwHttp(e); }
  }
}

ApiTags('audit')(AuditController);
Controller('audit')(AuditController);
// FIX: use Inject() instead of Reflect.defineMetadata for reliable DI in plain JS
Inject(AuditService)(AuditController, undefined, 0);

const proto = AuditController.prototype;

// GET /audit
Get()(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiOperation({ summary: 'Registro audit globale' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'entityType', required: false, enum: ['template', 'document'] })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'actor',      required: false, type: String })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'fromDate',   required: false })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'toDate',     required: false })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'limit',      required: false, type: Number, example: 50 })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'offset',     required: false, type: Number, example: 0  })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
Query()(proto, 'findAll', 0);

module.exports = { AuditController };
