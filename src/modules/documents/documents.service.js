'use strict';

const { Injectable }               = require('@nestjs/common');
const { getPool, withTransaction } = require('../../database/database');
const { AuditService }             = require('../audit/audit.service');
const { TemplatesService }         = require('../templates/templates.service');
const { makeError }                = require('../common/http.utils');
const pdfService = require('./pdf.service');
const q          = require('./documents.queries');

const PDF_JOB_CONCURRENCY = Math.max(parseInt(process.env.PDF_JOB_CONCURRENCY || '1', 10), 1);
let activePdfJobs        = 0;
const queuedPdfJobs      = [];
let queueRecoveryStarted = false;

function enqueuePdfJob(task) {
  queuedPdfJobs.push(task);
  drainPdfQueue();
}

function drainPdfQueue() {
  while (activePdfJobs < PDF_JOB_CONCURRENCY && queuedPdfJobs.length > 0) {
    const task = queuedPdfJobs.shift();
    activePdfJobs += 1;
    setImmediate(async () => {
      try       { await task(); }
      finally   { activePdfJobs -= 1; drainPdfQueue(); }
    });
  }
}

class DocumentsService {
  constructor(auditService, templatesService) {
    this.auditService     = auditService;
    this.templatesService = templatesService;
    setImmediate(() => { this._ensureQueueRecovery().catch(() => {}); });
  }

  async _findOneOrThrow(id) {
    const doc = await this.findOne(id);
    if (!doc) throw makeError('Documento non trovato', 404);
    return doc;
  }

  async _ensureQueueRecovery() {
    if (queueRecoveryStarted) return;
    queueRecoveryStarted = true;
    try {
      const rows = await q.findQueuedPdfJobs();
      for (const row of rows) enqueuePdfJob(() => this.processPdfJob(row.id));
    } catch (_) {
      queueRecoveryStarted = false;
    }
  }

  async findAll({ status, limit = 20, offset = 0 } = {}) {
    const { data, total } = await q.findAll({ status, limit, offset });
    return { data, total, limit, offset };
  }

  async findOne(id) { return q.findById(id); }

  async create({ name, templateId, created_by = 'system' }) {
    if (!name || name.trim().length === 0) throw makeError('Il nome documento è obbligatorio', 400);
    const template = await this.templatesService.findOne(templateId);
    if (!template) throw makeError('Template non trovato', 404);

    const doc = await withTransaction(getPool(), async (client) => {
      const d = await q.insertDocument(client, {
        name: name.trim(), templateId,
        templateVersion: template.version,
        content: template.content, createdBy: created_by,
      });
      await q.insertDocumentVersion(client, {
        documentId: d.id, version: 1, content: template.content,
        fieldValues: {}, action: 'create', createdBy: created_by,
      });
      return d;
    });

    await this.auditService.log('document', doc.id, 'create', created_by, {
      name, template_id: templateId,
    });
    return doc;
  }

  async _getFieldDefinitions(doc) {
    if (!doc.template_id) return [];
    const template = await this.templatesService.findOne(doc.template_id);
    return template?.fields || [];
  }

  async update(id, { name, content, fieldValues, created_by = 'system' }) {
    const existing = await this._findOneOrThrow(id);

    if (fieldValues !== undefined &&
        (fieldValues === null || typeof fieldValues !== 'object' || Array.isArray(fieldValues))) {
      throw makeError('fieldValues deve essere un oggetto', 400);
    }

    const maxVer         = await q.getMaxVersion(id);
    const nextVersion    = maxVer + 1;
    const newContent     = content      !== undefined ? content      : existing.content;
    const newFieldValues = fieldValues  !== undefined ? fieldValues  : existing.field_values;

    const updated = await withTransaction(getPool(), async (client) => {
      const d = await q.updateDocument(client, {
        id, name: name ? name.trim() : existing.name,
        content: newContent, fieldValues: newFieldValues,
      });
      await q.insertDocumentVersion(client, {
        documentId: id, version: nextVersion, content: newContent,
        fieldValues: newFieldValues, action: 'update', createdBy: created_by,
      });
      return d;
    });

    await this.auditService.log('document', id, 'update', created_by, { version: nextVersion });
    return updated;
  }

  async _getMissingRequiredFields(doc) {
    const fields = await this._getFieldDefinitions(doc);
    return pdfService.getMissingRequiredFields(fields, doc.field_values || {});
  }

  async enqueuePdfGeneration(id, actor = 'system') {
    await this._ensureQueueRecovery();
    const doc = await this._findOneOrThrow(id);

    const missing = await this._getMissingRequiredFields(doc);
    if (missing.length > 0) {
      throw makeError(
        `Campi obbligatori non compilati: ${missing.join(', ')}`,
        422,
      );
    }

    const job = await q.insertPdfJob(id, actor);
    enqueuePdfJob(() => this.processPdfJob(job.id));
    await this.auditService.log('document', id, 'enqueue_pdf', actor, { job_id: job.id });
    return job;
  }

  async processPdfJob(jobId) {
    const job = await q.findPdfJobById(jobId);
    if (!job || job.status !== 'queued') return;
    await q.updatePdfJobRunning(jobId);
    try {
      const doc    = await this._findOneOrThrow(job.document_id);
      const fields = await this._getFieldDefinitions(doc);
      const { filename, unresolvedFields } = await pdfService.generatePdf(
        doc.content, doc.field_values || {},
        { title: doc.name, strict: true, fields },
      );
      await q.updatePdfJobCompleted(jobId, filename, unresolvedFields);
      await q.updateDocumentStatusGenerated(doc.id);
      await this.auditService.log('document', doc.id, 'generate_pdf_completed', job.requested_by, {
        job_id: jobId, filename, unresolved_fields: unresolvedFields,
      });
    } catch (err) {
      await q.updatePdfJobFailed(jobId, err.message);
      await this.auditService.log('document', job.document_id, 'generate_pdf_failed', job.requested_by, {
        job_id: jobId, error: err.message,
      });
    }
  }

  async getPdfJob(documentId, jobId)          { return q.findPdfJob(documentId, jobId); }
  async getPdfJobs(documentId)                { return q.findPdfJobsByDocument(documentId); }

  async getCompletedPdfJob(documentId, jobId) {
    const job = await this.getPdfJob(documentId, jobId);
    if (!job) throw makeError('Job PDF non trovato', 404);
    if (job.status !== 'completed' || !job.filename) throw makeError('PDF non ancora disponibile', 409);
    return job;
  }

  async getLatestCompletedPdfJob(documentId) {
    const job = await q.findLatestCompletedPdfJob(documentId);
    if (!job) throw makeError('Nessun PDF completato per questo documento', 404);
    return job;
  }

  async previewPdf(id) {
    const doc    = await this._findOneOrThrow(id);
    const fields = await this._getFieldDefinitions(doc);
    const { filename } = await pdfService.generatePdf(
      doc.content, doc.field_values || {},
      { title: doc.name, strict: false, fields },
    );
    return { filename };
  }

  async restore(id, targetVersion, actor = 'system') {
    const existing   = await this._findOneOrThrow(id);
    const versionRow = await q.findVersionById(id, targetVersion);
    if (!versionRow) throw makeError(`Versione ${targetVersion} non trovata`, 404);

    const maxVer      = await q.getMaxVersion(id);
    const nextVersion = maxVer + 1;

    const restored = await withTransaction(getPool(), async (client) => {
      const d = await q.restoreDocument(client, {
        id, content: versionRow.content, fieldValues: versionRow.field_values,
      });
      await q.insertDocumentVersion(client, {
        documentId: id, version: nextVersion,
        content: versionRow.content, fieldValues: versionRow.field_values,
        action: `restore_from_v${targetVersion}`, createdBy: actor,
      });
      return d;
    });

    await this.auditService.log('document', id, 'restore', actor, {
      from_version: targetVersion, new_version: nextVersion,
    });
    return restored;
  }

  async getVersions(id)                { return q.findVersions(id); }
  async getVersionContent(id, version) { return q.findVersionById(id, version); }

  async delete(id, actor = 'system') {
    const existing = await this._findOneOrThrow(id);
    await q.deleteDocument(id);
    await this.auditService.log('document', id, 'delete', actor, { name: existing.name });
    return { deleted: true };
  }
}

Injectable()(DocumentsService);
module.exports = { DocumentsService };
