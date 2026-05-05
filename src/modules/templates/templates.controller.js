'use strict';

const multer = require('multer');
const {
  Controller, Get, Post, Put, Delete, Param, Query, Body,
  Req, Res, HttpCode, HttpStatus, HttpException,
  UseInterceptors, UploadedFile, Inject,
} = require('@nestjs/common');
const { FileInterceptor } = require('@nestjs/platform-express');
const {
  ApiTags, ApiOperation, ApiParam, ApiQuery,
  ApiResponse, ApiConsumes, ApiBody,
} = require('@nestjs/swagger');

const { TemplatesService } = require('./templates.service');
const { AuditService }     = require('../audit/audit.service');
const {
  getActor, parsePagination, parseVersionOrThrow, readAndCleanupUpload,
} = require('../common/http.utils');

const UPLOAD_PATH   = process.env.UPLOAD_PATH || './storage/uploads';
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024;

const multerOptions = {
  dest: UPLOAD_PATH,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (
      file.originalname.endsWith('.md') ||
      file.mimetype === 'text/markdown' ||
      file.mimetype === 'text/plain'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Formato file non supportato. Accettati: .md'), false);
    }
  },
};

function throwHttp(err) {
  throw new HttpException(err.message || 'Errore interno', err.status || 500);
}

class TemplatesController {
  constructor(templatesService, auditService) {
    this.templatesService = templatesService;
    this.auditService     = auditService;
  }

  async findAll(query) {
    try {
      const { limit, offset } = parsePagination(query);
      return this.templatesService.findAll({ status: query.status, limit, offset });
    } catch (e) { throwHttp(e); }
  }

  async findOne(id) {
    const template = await this.templatesService.findOne(id).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);
    return template;
  }

  async getVersions(id) {
    const template = await this.templatesService.findOne(id).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);
    return this.templatesService.getVersions(id);
  }

  async getVersionContent(id, version) {
    let ver;
    try { ver = parseVersionOrThrow(version); } catch (e) { throwHttp(e); }
    const content = await this.templatesService.getVersionContent(id, ver).catch(throwHttp);
    if (!content) throw new HttpException('Versione non trovata', 404);
    return content;
  }

  async getAudit(id, query) {
    try {
      const { limit, offset } = parsePagination(query, { limit: 50, offset: 0 });
      return this.auditService.findByEntity('template', id, { limit, offset });
    } catch (e) { throwHttp(e); }
  }

  async create(body, req) {
    const { name, description, content, fields } = body;
    if (!name)    throw new HttpException('name è obbligatorio', 400);
    if (!content) throw new HttpException('content è obbligatorio', 400);
    return this.templatesService.create({
      name, description, content, fields, created_by: getActor(req),
    }).catch(throwHttp);
  }

  async importFile(file, body, req) {
    if (!file) throw new HttpException('File mancante', 400);
    const content = readAndCleanupUpload(file);
    const name    = body.name || file.originalname.replace('.md', '');
    return this.templatesService.importFromMarkdown(content, name, getActor(req)).catch(throwHttp);
  }

  async validateMd(body) {
    return this.templatesService.validateMarkdown(body.content);
  }

  async update(id, body, req) {
    const { name, description, content, fields } = body;
    return this.templatesService.update(id, {
      name, description, content, fields, created_by: getActor(req),
    }).catch(throwHttp);
  }

  async restore(id, version, req) {
    let ver;
    try { ver = parseVersionOrThrow(version); } catch (e) { throwHttp(e); }
    return this.templatesService.restore(id, ver, getActor(req)).catch(throwHttp);
  }

  async exportMd(id, res) {
    const template = await this.templatesService.findOne(id).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);
    const content  = this.templatesService.getExportContent(template);
    const safeName = template.name.replace(/[^a-z0-9_\-]/gi, '_');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_v${template.version}.md"`);
    res.send(content);
  }

  async remove(id, req) {
    return this.templatesService.delete(id, getActor(req)).catch(throwHttp);
  }
}

ApiTags('templates')(TemplatesController);
Controller('templates')(TemplatesController);
Inject(TemplatesService)(TemplatesController, undefined, 0);
Inject(AuditService)(TemplatesController, undefined, 1);

const proto = TemplatesController.prototype;

// GET /templates
Get()(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiOperation({ summary: 'Lista template' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'status', required: false, enum: ['draft', 'published'] })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'limit',  required: false, type: Number, example: 20 })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'offset', required: false, type: Number, example: 0  })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'findAll');
Query()(proto, 'findAll', 0);

// GET /templates/:id
Get(':id')(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiOperation({ summary: 'Dettaglio template' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiResponse({ status: 404, description: 'Template non trovato' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'findOne');
Param('id')(proto, 'findOne', 0);

// GET /templates/:id/versions
Get(':id/versions')(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
ApiOperation({ summary: 'Cronologia versioni template' })(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'getVersions');
Param('id')(proto, 'getVersions', 0);

// GET /templates/:id/versions/:version
Get(':id/versions/:version')(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiOperation({ summary: 'Contenuto di una versione specifica' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiParam({ name: 'id',      description: 'UUID template' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiParam({ name: 'version', description: 'Numero versione (intero positivo)' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'getVersionContent');
Param('id')(proto, 'getVersionContent', 0);
Param('version')(proto, 'getVersionContent', 1);

// GET /templates/:id/audit
Get(':id/audit')(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiOperation({ summary: 'Audit log del template' })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiQuery({ name: 'limit',    required: false, type: Number, example: 50 })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiQuery({ name: 'offset',   required: false, type: Number, example: 0  })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'getAudit');
Param('id')(proto, 'getAudit', 0);
Query()(proto, 'getAudit', 1);

// POST /templates
Post()(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
HttpCode(HttpStatus.CREATED)(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
ApiOperation({ summary: 'Crea template (JSON)' })(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
ApiBody({
  schema: {
    title: 'CreateTemplateDto',
    required: ['name', 'content'],
    properties: {
      name:        { type: 'string', example: 'Template Contratto' },
      description: { type: 'string' },
      content:     { type: 'string', example: '# {{titolo}}\n\nCliente: {{cliente}}' },
      fields:      {
        type: 'array',
        items: {
          title: 'TemplateFieldDto',
          type: 'object',
          properties: {
            name:     { type: 'string', example: 'titolo' },
            label:    { type: 'string', example: 'Titolo' },
            type:     { type: 'string', enum: ['text', 'number', 'date', 'boolean'], example: 'text' },
            required: { type: 'boolean', example: true },
          },
        },
      },
    },
  },
})(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'create');
Body()(proto, 'create', 0);
Req()(proto, 'create', 1);

// POST /templates/upload
Post('upload')(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
HttpCode(HttpStatus.CREATED)(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
UseInterceptors(FileInterceptor('file', multerOptions))(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
ApiOperation({ summary: 'Importa template da file .md (multipart)' })(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
ApiConsumes('multipart/form-data')(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
ApiBody({
  schema: {
    title: 'ImportTemplateFileDto',
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome del template (opzionale, default: nome file)' },
      file: { type: 'string', format: 'binary' },
    },
  },
})(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
Reflect.defineMetadata('design:paramtypes', [Object, Object, Object], proto, 'importFile');
UploadedFile()(proto, 'importFile', 0);
Body()(proto, 'importFile', 1);
Req()(proto, 'importFile', 2);

// POST /templates/validate-md
Post('validate-md')(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));
HttpCode(HttpStatus.OK)(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));
ApiOperation({ summary: 'Valida contenuto Markdown senza creare il template' })(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));
ApiBody({
  schema: {
    title: 'ValidateMarkdownDto',
    required: ['content'],
    properties: {
      content: { type: 'string', example: '# {{titolo}}\n\nCliente: {{cliente}}' },
    },
  },
})(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'validateMd');
Body()(proto, 'validateMd', 0);

// PUT /templates/:id
Put(':id')(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiOperation({ summary: 'Aggiorna template (crea nuova versione)' })(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiBody({
  schema: {
    title: 'UpdateTemplateDto',
    properties: {
      name:        { type: 'string' },
      description: { type: 'string' },
      content:     { type: 'string' },
      fields:      { type: 'array', items: { type: 'object' } },
    },
  },
})(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
Reflect.defineMetadata('design:paramtypes', [Object, Object, Object], proto, 'update');
Param('id')(proto, 'update', 0);
Body()(proto, 'update', 1);
Req()(proto, 'update', 2);

// POST /templates/:id/restore/:version
Post(':id/restore/:version')(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
HttpCode(HttpStatus.CREATED)(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
ApiOperation({ summary: 'Ripristina una versione precedente del template' })(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
ApiParam({ name: 'id',      description: 'UUID template' })(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
ApiParam({ name: 'version', description: 'Versione da ripristinare' })(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
Reflect.defineMetadata('design:paramtypes', [Object, Object, Object], proto, 'restore');
Param('id')(proto, 'restore', 0);
Param('version')(proto, 'restore', 1);
Req()(proto, 'restore', 2);

// GET /templates/:id/export
Get(':id/export')(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiOperation({ summary: 'Scarica il template come file .md' })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiResponse({ status: 200, description: 'File .md in download', content: { 'text/markdown': {} } })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'exportMd');
Param('id')(proto, 'exportMd', 0);
Res()(proto, 'exportMd', 1);

// DELETE /templates/:id
Delete(':id')(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
ApiOperation({ summary: 'Elimina template' })(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'remove');
Param('id')(proto, 'remove', 0);
Req()(proto, 'remove', 1);

module.exports = { TemplatesController };
