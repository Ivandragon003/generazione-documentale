const { Injectable } = require('@nestjs/common');
const { getPool } = require('../../database/database');
const { AuditService } = require('../audit/audit.service');
const { TemplatesService } = require('../templates/templates.service');
const pdfService = require('./pdf.service');
const q = require('./documents.queries');

const PDF_JOB_CONCURRENCY = Math.max(parseInt(process.env.PDF_JOB_CONCURRENCY || '1', 10), 1);
let activePdfJobs = 0;
const queuedPdfJobs = [];
let queueRecoveryStarted = false;

function makeError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function enqueuePdfJob(task) {
  queuedPdfJobs.push(task);
  drainPdfQueue();
}

function drainPdfQueue() {
  while (activePdfJobs < PDF_JOB_CONCURRENCY && queuedPdfJobs.length > 0) {
    const task = queuedPdfJobs.shift();
    activePdfJobs += 1;
    setImmediate(async () => {
      try {
        await task();
      } finally {
        activePdfJobs -= 1;
        drainPdfQueue();
      }
    });
  }
}

class DocumentsService {
  constructor(auditService, templatesService) {
    this.auditService = auditService;
    this.templatesService = templatesService;

    setImmediate(() => {
      this._ensureQueueRecovery().catch(() => {});
    });
  }

  async _ensureQueueRecovery() {
    if (queueRecoveryStarted) return;
    queueRecoveryStarted = true;
    try {
      const rows = await q.findQueuedPdfJobs();
      for (const row of rows) {
        enqueuePdfJob(() => this.processPdfJob(row.id));
      }
    } catch (_) {
      queueRecoveryStarted = false;
    }
  }

  async findAll({ status, limit = 20, offset = 0 } = {}) {
    const { data, total } = await q.findAll({ status, limit, offset });
    return { data, total, limit, offset };
  }

  async findOne(id) {
    return q.findById(id);
  }

  async create({ name, templateId, created_by = 'system' }) {
    if (!name || name.trim().length === 0) throw makeError('Il nome documento e obbligatorio', 400);

    const template = await this.templatesService.findOne(templateId);
    if (!template) throw makeError('Template non trovato', 404);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const doc = await q.insertDocument(client, {
        name: name.trim(),
        templateId,
        templateVersion: template.version,
        content: template.content,
        createdBy: created_by,
      });
      await q.insertDocumentVersion(client, {
        documentId: doc.id, version: 1, content: template.content,
        fieldValues: {}, action: 'create', createdBy: created_by,
      });
      await client.query('COMMIT');
      await this.auditService.log('document', doc.id, 'create', created_by, {
        name, template_id: templateId,
      });
      return doc;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async _getFieldDefinitions(doc) {
    if (!doc.template_id) return [];
    const template = await this.templatesService.findOne(doc.template_id);
    return template?.fields || [];
  }

  async update(id, { name, content, fieldValues, created_by = 'system' }) {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    if (
      fieldValues !== undefined &&
      (fieldValues === null || typeof fieldValues !== 'object' || Array.isArray(fieldValues))
    ) {
      throw makeError('fieldValues deve essere un oggetto', 400);
    }

    const maxVer = await q.getMaxVersion(id);
    const nextVersion = maxVer + 1;
    const newContent = content !== undefined ? content : existing.content;
    const newFieldValues = fieldValues !== undefined ? fieldValues : existing.field_values;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const updated = await q.updateDocument(client, {
        id,
        name: name ? name.trim() : existing.name,
        content: newContent,
        fieldValues: newFieldValues,
      });
      await q.insertDocumentVersion(client, {
        documentId: id, version: nextVersion, content: newContent,
        fieldValues: newFieldValues, action: 'update', createdBy: created_by,
      });
      await client.query('COMMIT');
      await this.auditService.log('document', id, 'update', created_by, { version: nextVersion });
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async enqueuePdfGeneration(id, actor = 'system') {
    await this._ensureQueueRecovery();
    const doc = await this.findOne(id);
    if (!doc) throw makeError('Documento non trovato', 404);

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
      const doc = await this.findOne(job.document_id);
      if (!doc) throw makeError('Documento non trovato', 404);

      const fields = await this._getFieldDefinitions(doc);
      const { filename, unresolvedFields } = await pdfService.generatePdf(
        doc.content,
        doc.field_values || {},
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

  async getPdfJob(documentId, jobId) {
    return q.findPdfJob(documentId, jobId);
  }

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

  async getPdfJobs(documentId) {
    return q.findPdfJobsByDocument(documentId);
  }

  async previewPdf(id) {
    const doc = await this.findOne(id);
    if (!doc) throw makeError('Documento non trovato', 404);
    const fields = await this._getFieldDefinitions(doc);
    const { filename } = await pdfService.generatePdf(doc.content, doc.field_values || {}, {
      title: doc.name, strict: false, fields,
    });
    return { filename };
  }

  async changeStatus(id, newStatus, actor = 'system') {
    const allowed = ['draft', 'generated', 'published', 'archived'];
    if (!allowed.includes(newStatus)) throw makeError('Stato non valido', 400);

    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    await q.changeDocumentStatus(id, newStatus);
    await this.auditService.log('document', id, 'status_change', actor, {
      from: existing.status, to: newStatus,
    });
    return { ...existing, status: newStatus };
  }

  async rename(id, newName, actor = 'system') {
    if (!newName || newName.trim().length === 0) throw makeError('Il nome non puo essere vuoto', 400);
    if (newName.trim().length > 255) throw makeError('Nome troppo lungo (max 255 caratteri)', 400);

    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const updated = await q.renameDocument(id, newName.trim());
    await this.auditService.log('document', id, 'rename', actor, {
      from: existing.name, to: newName.trim(),
    });
    return updated;
  }

  async restore(id, targetVersion, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const versionRow = await q.findVersionById(id, targetVersion);
    if (!versionRow) throw makeError(`Versione ${targetVersion} non trovata`, 404);

    const maxVer = await q.getMaxVersion(id);
    const nextVersion = maxVer + 1;
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const restored = await q.restoreDocument(client, {
        id, content: versionRow.content, fieldValues: versionRow.field_values,
      });
      await q.insertDocumentVersion(client, {
        documentId: id, version: nextVersion,
        content: versionRow.content, fieldValues: versionRow.field_values,
        action: `restore_from_v${targetVersion}`, createdBy: actor,
      });
      await client.query('COMMIT');
      await this.auditService.log('document', id, 'restore', actor, {
        from_version: targetVersion, new_version: nextVersion,
      });
      return restored;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getVersions(id) {
    return q.findVersions(id);
  }

  async getVersionContent(id, version) {
    return q.findVersionById(id, version);
  }

  async delete(id, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);
    await q.deleteDocument(id);
    await this.auditService.log('document', id, 'delete', actor, { name: existing.name });
    return { deleted: true };
  }
}

Injectable()(DocumentsService);

module.exports = { DocumentsService };