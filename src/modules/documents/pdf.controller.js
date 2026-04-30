'use strict';

const { Controller, Post, Param, HttpException } = require('@nestjs/common');
const { ApiTags, ApiOperation, ApiParam, ApiResponse } = require('@nestjs/swagger');
const { TemplatesService } = require('../templates/templates.service');

function throwHttp(err) {
  throw new HttpException(err.message || 'Errore interno', err.status || 500);
}

class PdfController {
  constructor(templatesService) {
    this.templatesService = templatesService;
  }

  // POST /pdf/templates/:templateId/validate
  async validateTemplate(templateId) {
    const template = await this.templatesService.findOne(templateId).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);

    const isAvailable = template.status === 'published' || template.status === 'draft';
    return {
      templateId: template.id,
      valid:      isAvailable,
      available:  isAvailable,
      status:     template.status,
      version:    template.version,
      fields:     template.fields || [],
    };
  }
}

// ─── Decoratori di classe ─────────────────────────────────────────────────────

ApiTags('pdf')(PdfController);
Controller('pdf')(PdfController);

// ─── Decoratori di metodo e parametro ────────────────────────────────────────

const proto = PdfController.prototype;

// POST /pdf/templates/:templateId/validate
Post('templates/:templateId/validate')(proto, 'validateTemplate', Object.getOwnPropertyDescriptor(proto, 'validateTemplate'));
ApiOperation({ summary: 'Valida disponibilità template per generazione PDF' })(proto, 'validateTemplate', Object.getOwnPropertyDescriptor(proto, 'validateTemplate'));
ApiParam({ name: 'templateId', description: 'UUID template' })(proto, 'validateTemplate', Object.getOwnPropertyDescriptor(proto, 'validateTemplate'));
ApiResponse({ status: 200, description: 'Stato disponibilità template' })(proto, 'validateTemplate', Object.getOwnPropertyDescriptor(proto, 'validateTemplate'));
ApiResponse({ status: 404, description: 'Template non trovato' })(proto, 'validateTemplate', Object.getOwnPropertyDescriptor(proto, 'validateTemplate'));
Param('templateId')(proto, 'validateTemplate', 0);

module.exports = { PdfController };