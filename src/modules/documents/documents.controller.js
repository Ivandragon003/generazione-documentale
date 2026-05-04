'use strict';

const {
  Controller, Get, Post, Put, Delete,
  Param, Query, Body, Req, Res,
  HttpCode, HttpStatus, HttpException, Inject,
} = require('@nestjs/common');
const {
  ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiBody,
} = require('@nestjs/swagger');

const { DocumentsService } = require('./documents.service');
const { AuditService }     = require('../audit/audit.service');
const pdfService           = require('./pdf.service');
const { getActor, parsePagination, parseVersionOrThrow } = require('../common/http.utils');

function throwHttp(err) {
  throw new HttpException(err.message || 'Errore interno', err.status || 500);
}

class DocumentsController {
  constructor(documentsService, auditService) {
    this.documentsService = documentsService;
    this.auditService     = auditService;
  }

  async findAll(query) {
    try {
      const { limit, offset } = parsePagination(query);
      return this.documentsService.findAll({ status: query.status, limit, offset });
    } catch (e) { throwHttp(e); }
  }

  async findOne(id) {
    const doc = await this.documentsService.findOne(id).catch(throwHttp);
    if (!doc) throw new HttpException('Documento non trovato', 404);
    return doc;
  }

  async create(body, req) {
    const { name, templateId } = body;
    if (!name)       throw new HttpException('name è obbligatorio', 400);
    if (!templateId) throw new HttpException('templateId è obbligatorio', 400);
    return this.documentsService.create({ name, templateId, created_by: getActor(req) }).catch(throwHttp);
  }

  async update(id, body, req) {
    const { name, content, fieldValues } = body;
    return this.documentsService.update(id, {
      name, content, fieldValues, created_by: getActor(req),
    }).catch(throwHttp);
  }

  async generatePdf(id, req) {
    const job = await this.documentsService.enqueuePdfGeneration(id, getActor(req)).catch(throwHttp);
    return {
      message:    'Generazione PDF accodata',
      jobId:      job.id,
      status:     job.status,
      documentId: job.document_id,
    };
  }

  async getPdfJobs(id) {
    const doc = await this.documentsService.findOne(id).catch(throwHttp);
    if (!doc) throw new HttpException('Documento non trovato', 404);
    return this.documentsService.getPdfJobs(id);
  }

  async getPdfJob(id, jobId) {
    const job = await this.documentsService.getPdfJob(id, jobId).catch(throwHttp);
    if (!job) throw new HttpException('Job PDF non trovato', 404);
    return job;
  }

  async downloadPdf(id, jobId, res) {
    const job    = await this.documentsService.getCompletedPdfJob(id, jobId).catch(throwHttp);
    const stream = await pdfService.getPdfStream(job.filename).catch(throwHttp);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    stream.on('error', (err) => res.status(500).end(err.message));
    stream.pipe(res);
  }

  async latestPdf(id, res) {
    const job    = await this.documentsService.getLatestCompletedPdfJob(id).catch(throwHttp);
    const stream = await pdfService.getPdfStream(job.filename).catch(throwHttp);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    stream.on('error', (err) => res.status(500).end(err.message));
    stream.pipe(res);
  }

  async previewPdf(id, res) {
    const { filename } = await this.documentsService.previewPdf(id).catch(throwHttp);
    const stream       = await pdfService.getPdfStream(filename).catch(throwHttp);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview-temporanea.pdf"');
    stream.on('error', (err) => res.status(500).end(err.message));
    stream.pipe(res);
    stream.on('end', () => { pdfService.deletePdf(filename).catch(() => {}); });
  }

  async getVersions(id) {
    const doc = await this.documentsService.findOne(id).catch(throwHttp);
    if (!doc) throw new HttpException('Documento non trovato', 404);
    return this.documentsService.getVersions(id);
  }

  async getVersionContent(id, version) {
    let ver;
    try { ver = parseVersionOrThrow(version); } catch (e) { throwHttp(e); }
    const v = await this.documentsService.getVersionContent(id, ver).catch(throwHttp);
    if (!v) throw new HttpException('Versione non trovata', 404);
    return v;
  }

  async restoreVersion(id, version, req) {
    let ver;
    try { ver = parseVersionOrThrow(version); } catch (e) { throwHttp(e); }
    return this.documentsService.restore(id, ver, getActor(req)).catch(throwHttp);
  }

  async exportMd(id, res) {
    const doc = await this.documentsService.findOne(id).catch(throwHttp);
    if (!doc) throw new HttpException('Documento non trovato', 404);
    const safeName = doc.name.replace(/[^a-z0-9_\-]/gi, '_');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.md"`);
    res.send(doc.content);
  }

  async getAudit(id, query) {
    try {
      const { limit, offset } = parsePagination(query, { limit: 50, offset: 0 });
      return this.auditService.findByEntity('document', id, { limit, offset });
    } catch (e) { throwHttp(e); }
  }

  async remove(id, req) {
    return this.documentsService.delete(id, getActor(req)).catch(throwHttp);
  }
}

ApiTags('documents')(DocumentsController);
Controller('documents')(DocumentsController);
Inject(DocumentsService)(DocumentsController, undefined, 0);
Inject(AuditService)(DocumentsController, undefined, 1);

const proto = DocumentsController.prototype;

// GET /documents
Get()(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiOperation({ summary: 'Lista documenti' })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'status', required: false, enum: ['draft', 'generated', 'published', 'archived'] })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'limit',  required: false, type: Number, example: 20 })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
ApiQuery({ name: 'offset', required: false, type: Number, example: 0  })(proto, 'findAll', Object.getOwnPropertyDescriptor(proto, 'findAll'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'findAll');
Query()(proto, 'findAll', 0);

// GET /documents/:id
Get(':id')(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiOperation({ summary: 'Dettaglio documento' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
ApiResponse({ status: 404, description: 'Documento non trovato' })(proto, 'findOne', Object.getOwnPropertyDescriptor(proto, 'findOne'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'findOne');
Param('id')(proto, 'findOne', 0);

// POST /documents
Post()(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
HttpCode(HttpStatus.CREATED)(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
ApiOperation({ summary: 'Crea documento da template' })(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
ApiBody({
  schema: {
    title: 'CreateDocumentDto',
    required: ['name', 'templateId'],
    properties: {
      name:       { type: 'string', example: 'Capitolato Beta' },
      templateId: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
    },
  },
})(proto, 'create', Object.getOwnPropertyDescriptor(proto, 'create'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'create');
Body()(proto, 'create', 0);
Req()(proto, 'create', 1);

// PUT /documents/:id
Put(':id')(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiOperation({ summary: 'Aggiorna contenuto/fieldValues documento' })(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
ApiBody({
  schema: {
    title: 'UpdateDocumentDto',
    properties: {
      name:        { type: 'string' },
      content:     { type: 'string' },
      fieldValues: {
        type: 'object',
        description: 'Mappa chiave-valore dei campi template',
        additionalProperties: { type: 'string' },
        example: { titolo: 'Contratto 2026', cliente: 'Mario Rossi', importo: '1000' },
      },
    },
  },
})(proto, 'update', Object.getOwnPropertyDescriptor(proto, 'update'));
Reflect.defineMetadata('design:paramtypes', [Object, Object, Object], proto, 'update');
Param('id')(proto, 'update', 0);
Body()(proto, 'update', 1);
Req()(proto, 'update', 2);

// POST /documents/:id/generate-pdf → 202
Post(':id/generate-pdf')(proto, 'generatePdf', Object.getOwnPropertyDescriptor(proto, 'generatePdf'));
HttpCode(HttpStatus.ACCEPTED)(proto, 'generatePdf', Object.getOwnPropertyDescriptor(proto, 'generatePdf'));
ApiOperation({ summary: 'Accoda generazione PDF asincrona' })(proto, 'generatePdf', Object.getOwnPropertyDescriptor(proto, 'generatePdf'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'generatePdf', Object.getOwnPropertyDescriptor(proto, 'generatePdf'));
ApiResponse({ status: 202, description: 'Job PDF accodato' })(proto, 'generatePdf', Object.getOwnPropertyDescriptor(proto, 'generatePdf'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'generatePdf');
Param('id')(proto, 'generatePdf', 0);
Req()(proto, 'generatePdf', 1);

// GET /documents/:id/pdf-jobs
Get(':id/pdf-jobs')(proto, 'getPdfJobs', Object.getOwnPropertyDescriptor(proto, 'getPdfJobs'));
ApiOperation({ summary: 'Lista job PDF del documento' })(proto, 'getPdfJobs', Object.getOwnPropertyDescriptor(proto, 'getPdfJobs'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'getPdfJobs', Object.getOwnPropertyDescriptor(proto, 'getPdfJobs'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'getPdfJobs');
Param('id')(proto, 'getPdfJobs', 0);

// GET /documents/:id/pdf-jobs/:jobId
Get(':id/pdf-jobs/:jobId')(proto, 'getPdfJob', Object.getOwnPropertyDescriptor(proto, 'getPdfJob'));
ApiOperation({ summary: 'Dettaglio job PDF' })(proto, 'getPdfJob', Object.getOwnPropertyDescriptor(proto, 'getPdfJob'));
ApiParam({ name: 'id',    description: 'UUID documento' })(proto, 'getPdfJob', Object.getOwnPropertyDescriptor(proto, 'getPdfJob'));
ApiParam({ name: 'jobId', description: 'UUID job PDF'   })(proto, 'getPdfJob', Object.getOwnPropertyDescriptor(proto, 'getPdfJob'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'getPdfJob');
Param('id')(proto, 'getPdfJob', 0);
Param('jobId')(proto, 'getPdfJob', 1);

// GET /documents/:id/pdf-jobs/:jobId/download
Get(':id/pdf-jobs/:jobId/download')(proto, 'downloadPdf', Object.getOwnPropertyDescriptor(proto, 'downloadPdf'));
ApiOperation({ summary: 'Scarica PDF del job completato' })(proto, 'downloadPdf', Object.getOwnPropertyDescriptor(proto, 'downloadPdf'));
ApiParam({ name: 'id',    description: 'UUID documento' })(proto, 'downloadPdf', Object.getOwnPropertyDescriptor(proto, 'downloadPdf'));
ApiParam({ name: 'jobId', description: 'UUID job PDF'   })(proto, 'downloadPdf', Object.getOwnPropertyDescriptor(proto, 'downloadPdf'));
Reflect.defineMetadata('design:paramtypes', [Object, Object, Object], proto, 'downloadPdf');
Param('id')(proto, 'downloadPdf', 0);
Param('jobId')(proto, 'downloadPdf', 1);
Res()(proto, 'downloadPdf', 2);

// GET /documents/:id/latest-pdf
Get(':id/latest-pdf')(proto, 'latestPdf', Object.getOwnPropertyDescriptor(proto, 'latestPdf'));
ApiOperation({ summary: "Scarica l'ultimo PDF completato" })(proto, 'latestPdf', Object.getOwnPropertyDescriptor(proto, 'latestPdf'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'latestPdf', Object.getOwnPropertyDescriptor(proto, 'latestPdf'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'latestPdf');
Param('id')(proto, 'latestPdf', 0);
Res()(proto, 'latestPdf', 1);

// GET /documents/:id/preview-pdf
Get(':id/preview-pdf')(proto, 'previewPdf', Object.getOwnPropertyDescriptor(proto, 'previewPdf'));
ApiOperation({ summary: 'Anteprima PDF temporanea (non salvata)' })(proto, 'previewPdf', Object.getOwnPropertyDescriptor(proto, 'previewPdf'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'previewPdf', Object.getOwnPropertyDescriptor(proto, 'previewPdf'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'previewPdf');
Param('id')(proto, 'previewPdf', 0);
Res()(proto, 'previewPdf', 1);

// GET /documents/:id/versions
Get(':id/versions')(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
ApiOperation({ summary: 'Cronologia versioni documento' })(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'getVersions', Object.getOwnPropertyDescriptor(proto, 'getVersions'));
Reflect.defineMetadata('design:paramtypes', [Object], proto, 'getVersions');
Param('id')(proto, 'getVersions', 0);

// GET /documents/:id/versions/:version
Get(':id/versions/:version')(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiOperation({ summary: 'Contenuto di una versione specifica del documento' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiParam({ name: 'id',      description: 'UUID documento' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
ApiParam({ name: 'version', description: 'Numero versione' })(proto, 'getVersionContent', Object.getOwnPropertyDescriptor(proto, 'getVersionContent'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'getVersionContent');
Param('id')(proto, 'getVersionContent', 0);
Param('version')(proto, 'getVersionContent', 1);

// POST /documents/:id/restore/:version
Post(':id/restore/:version')(proto, 'restoreVersion', Object.getOwnPropertyDescriptor(proto, 'restoreVersion'));
ApiOperation({ summary: 'Ripristina una versione precedente del documento' })(proto, 'restoreVersion', Object.getOwnPropertyDescriptor(proto, 'restoreVersion'));
ApiParam({ name: 'id',      description: 'UUID documento' })(proto, 'restoreVersion', Object.getOwnPropertyDescriptor(proto, 'restoreVersion'));
ApiParam({ name: 'version', description: 'Versione da ripristinare' })(proto, 'restoreVersion', Object.getOwnPropertyDescriptor(proto, 'restoreVersion'));
Reflect.defineMetadata('design:paramtypes', [Object, Object, Object], proto, 'restoreVersion');
Param('id')(proto, 'restoreVersion', 0);
Param('version')(proto, 'restoreVersion', 1);
Req()(proto, 'restoreVersion', 2);

// GET /documents/:id/export-md
Get(':id/export-md')(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiOperation({ summary: 'Esporta documento come file .md' })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'exportMd', Object.getOwnPropertyDescriptor(proto, 'exportMd'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'exportMd');
Param('id')(proto, 'exportMd', 0);
Res()(proto, 'exportMd', 1);

// GET /documents/:id/audit
Get(':id/audit')(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiOperation({ summary: 'Audit log del documento' })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiQuery({ name: 'limit',  required: false, type: Number, example: 50 })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
ApiQuery({ name: 'offset', required: false, type: Number, example: 0  })(proto, 'getAudit', Object.getOwnPropertyDescriptor(proto, 'getAudit'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'getAudit');
Param('id')(proto, 'getAudit', 0);
Query()(proto, 'getAudit', 1);

// DELETE /documents/:id
Delete(':id')(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
ApiOperation({ summary: 'Elimina documento' })(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
ApiParam({ name: 'id', description: 'UUID documento' })(proto, 'remove', Object.getOwnPropertyDescriptor(proto, 'remove'));
Reflect.defineMetadata('design:paramtypes', [Object, Object], proto, 'remove');
Param('id')(proto, 'remove', 0);
Req()(proto, 'remove', 1);

module.exports = { DocumentsController };
