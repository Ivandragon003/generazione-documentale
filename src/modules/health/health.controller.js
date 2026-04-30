'use strict';

const { Controller, Get, HttpCode, HttpStatus } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiResponse } = require('@nestjs/swagger');

class HealthController {
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

ApiTags('health')(HealthController);
Controller('health')(HealthController);

const proto = HealthController.prototype;

Get()(proto, 'check', Object.getOwnPropertyDescriptor(proto, 'check'));
HttpCode(HttpStatus.OK)(proto, 'check', Object.getOwnPropertyDescriptor(proto, 'check'));
ApiOperation({ summary: 'Health check applicazione' })(proto, 'check', Object.getOwnPropertyDescriptor(proto, 'check'));
ApiResponse({ status: 200, description: 'Applicazione attiva', schema: { properties: { status: { type: 'string', example: 'ok' }, timestamp: { type: 'string' } } } })(proto, 'check', Object.getOwnPropertyDescriptor(proto, 'check'));
Reflect.defineMetadata('design:paramtypes', [], proto, 'check');

module.exports = { HealthController };
