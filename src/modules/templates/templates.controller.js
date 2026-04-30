const path = require('path');
const multer = require('multer');
const {
  Controller, Get, Post, Put, Delete, Param, Query, Body,
  Req, Res, HttpCode, HttpStatus, HttpException, UseInterceptors, UploadedFile,
} = require('@nestjs/common');
const { FileInterceptor } = require('@nestjs/platform-express');
const { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiConsumes, ApiBody } = require('@nestjs/swagger');

const { TemplatesService } = require('./templates.service');
const { getActor, parsePagination, parseVersionOrThrow, readAndCleanupUpload } = require('../common/http.utils');

const UPLOAD_PATH = process.env.UPLOAD_PATH || './storage/uploads';
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

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
  constructor(templatesService) {
    this.templatesService = templatesService;
  }

  // GET /templates
  async findAll(query, req) {
    try {
      const { limit, offset } = parsePagination(query);
      return this.templatesService.findAll({ status: query.status, limit, offset });
    } catch (e) { throwHttp(e); }
  }

  // GET /templates/:id
  async findOne(id) {
    const template = await this.templatesService.findOne(id).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);
    return template;
  }

  // GET /templates/:id/versions
  async getVersions(id) {
    const template = await this.templatesService.findOne(id).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);
    return this.templatesService.getVersions(id);
  }

  // GET /templates/:id/versions/:version
  async getVersionContent(id, version) {
    let ver;
    try { ver = parseVersionOrThrow(version); } catch (e) { throwHttp(e); }
    const content = await this.templatesService.getVersionContent(id, ver).catch(throwHttp);
    if (!content) throw new HttpException('Versione non trovata', 404);
    return content;
  }

  // POST /templates (JSON)
  async create(body, req) {
    const { name, description, content, fields } = body;
    if (!name)    throw new HttpException('name è obbligatorio', 400);
    if (!content) throw new HttpException('content è obbligatorio', 400);
    return this.templatesService.create({
      name, description, content, fields, created_by: getActor(req),
    }).catch(throwHttp);
  }

  // POST /templates (multipart)
  async importFile(file, body, req) {
    if (!file) throw new HttpException('File mancante', 400);
    const content = readAndCleanupUpload(file);
    const name = body.name || file.originalname.replace('.md', '');
    return this.templatesService.importFromMarkdown(content, name, getActor(req)).catch(throwHttp);
  }

  // POST /templates/validate-md
  async validateMd(body) {
    return this.templatesService.validateMarkdown(body.content);
  }

  // POST /templates/validate-file
  async validateFile(file) {
    if (!file) throw new HttpException('File mancante', 400);
    const content = readAndCleanupUpload(file);
    return {
      filename: file.originalname,
      ...this.templatesService.validateMarkdown(content),
    };
  }

  // PUT /templates/:id
  async update(id, body, req) {
    const { name, description, content, fields } = body;
    return this.templatesService.update(id, {
      name, description, content, fields, created_by: getActor(req),
    }).catch(throwHttp);
  }

  // POST /templates/:id/publish
  async publish(id, req) {
    return this.templatesService.publish(id, getActor(req)).catch(throwHttp);
  }

  // POST /templates/:id/restore/:version
  async restore(id, version, req) {
    let ver;
    try { ver = parseVersionOrThrow(version); } catch (e) { throwHttp(e); }
    return this.templatesService.restore(id, ver, getActor(req)).catch(throwHttp);
  }

  // GET /templates/:id/export
  async exportMd(id, res) {
    const template = await this.templatesService.findOne(id).catch(throwHttp);
    if (!template) throw new HttpException('Template non trovato', 404);
    const content = this.templatesService.getExportContent(template);
    const safeName = template.name.replace(/[^a-z0-9_\-]/gi, '_');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_v${template.version}.md"`);
    res.send(content);
  }

  // DELETE /templates/:id
  async remove(id, req) {
    return this.templatesService.delete(id, getActor(req)).catch(throwHttp);
  }
}

// ─── Applicazione decoratori NestJS (JS puro, senza TypeScript) ──────────────

const { applyDecorators } = require('@nestjs/common');

ApiTags('templates')(TemplatesController);
Controller('templates')(TemplatesController);

const proto = TemplatesController.prototype;

// findAll
Get()(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiOperation({ summary: 'Lista template', description: 'Restituisce la lista paginata dei template.' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'status', required: false, enum: ['draft', 'published'] })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));

// findOne
Get(':id')(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiOperation({ summary: 'Dettaglio template' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiResponse({ status: 404, description: 'Template non trovato' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));

// getVersions
Get(':id/versions')(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
ApiOperation({ summary: 'Cronologia versioni template' })(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));

// getVersionContent
Get(':id/versions/:version')(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiOperation({ summary: 'Contenuto di una versione specifica del template' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiParam({ name: 'version', description: 'Numero versione (intero positivo)' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));

// create (JSON)
Post()(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
HttpCode(HttpStatus.CREATED)(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
ApiOperation({ summary: 'Crea template (JSON)' })(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
ApiBody({
  schema: {
    required: ['name', 'content'],
    properties: {
      name: { type: 'string', example: 'Template Contratto' },
      description: { type: 'string' },
      content: { type: 'string', example: '# {{titolo}}\n\nCliente: {{cliente}}' },
      fields: { type: 'array', items: { type: 'object' } },
    },
  },
})(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));

// importFile (multipart)
Post('upload')(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
HttpCode(HttpStatus.CREATED)(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
UseInterceptors(FileInterceptor('file', multerOptions))(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
ApiOperation({ summary: 'Importa template da file .md (multipart)' })(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
ApiConsumes('multipart/form-data')(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));
ApiBody({
  schema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      file: { type: 'string', format: 'binary' },
    },
  },
})(proto, 'importFile', Object.getOwnPropertyDescriptor(proto, 'importFile'));

// validateMd
Post('validate-md')(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));
ApiOperation({ summary: 'Valida contenuto Markdown senza creare il template' })(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));
ApiBody({
  schema: {
    required: ['content'],
    properties: { content: { type: 'string' } },
  },
})(proto, 'validateMd', Object.getOwnPropertyDescriptor(proto, 'validateMd'));

// validateFile
Post('validate-file')(proto, 'validateFile', Object.getOwnPropertyDescriptor(proto, 'validateFile'));
UseInterceptors(FileInterceptor('file', multerOptions))(proto, 'validateFile', Object.getOwnPropertyDescriptor(proto, 'validateFile'));
ApiOperation({ summary: 'Valida file .md caricato senza creare il template' })(proto, 'validateFile', Object.getOwnPropertyDescriptor(proto, 'validateFile'));
ApiConsumes('multipart/form-data')(proto, 'validateFile', Object.getOwnPropertyDescriptor(proto, 'validateFile'));
ApiBody({
  schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
})(proto, 'validateFile', Object.getOwnPropertyDescriptor(proto, 'validateFile'));

// update
Put(':id')(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiOperation({ summary: 'Aggiorna template (crea nuova versione)' })(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));

// publish
Post(':id/publish')(proto, 'publish', Object.getOwnPropertyDescriptor(proto, 'publish'));
ApiOperation({ summary: 'Pubblica il template' })(proto, 'publish', Object.getOwnPropertyDescriptor(proto, 'publish'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'publish', Object.getOwnPropertyDescriptor(proto, 'publish'));

// restore
Post(':id/restore/:version')(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
ApiOperation({ summary: 'Ripristina una versione precedente del template' })(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));
ApiParam({ name: 'version', description: 'Versione da ripristinare' })(proto, 'restore', Object.getOwnPropertyDescriptor(proto, 'restore'));

// exportMd
Get(':id/export')(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiOperation({ summary: 'Scarica il template come file .md' })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiResponse({ status: 200, description: 'File .md in download', content: { 'text/markdown': {} } })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));

// remove
Delete(':id')(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
ApiOperation({ summary: 'Elimina template' })(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
ApiParam({ name: 'id', description: 'UUID template' })(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));

module.exports = { TemplatesController };