const { getPool } = require('../../database');
const auditService = require('../audit/audit.service');
const pdfService = require('./pdf.service');
const templatesService = require('../templates/templates.service');

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

async function ensureQueueRecovery(processPdfJobFn) {
  if (queueRecoveryStarted) return;
  queueRecoveryStarted = true;

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id FROM pdf_jobs WHERE status = 'queued' ORDER BY created_at ASC`,
    );

    for (const row of result.rows) {
      enqueuePdfJob(async () => {
        await processPdfJobFn(row.id);
      });
    }
  } catch (_) {
    queueRecoveryStarted = false;
  }
}

class DocumentsService {
  constructor() {
    setImmediate(() => {
      ensureQueueRecovery(this.processPdfJob.bind(this)).catch(() => {});
    });
  }

  async findAll({ status, limit = 20, offset = 0 } = {}) {
    const pool = getPool();
    const conditions = [];
    const params = [];
    let i = 1;

    if (status) {
      conditions.push(`d.status = $${i++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT d.id, d.name, d.status, d.template_id, d.template_version,
              d.created_by, d.created_at, d.updated_at
       FROM documents d
       ${where}
       ORDER BY d.updated_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params,
    );

    const countParams = conditions.length > 0 ? params.slice(0, conditions.length) : [];
    const countResult = await pool.query(`SELECT COUNT(*) FROM documents d ${where}`, countParams);

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset,
    };
  }

  async findOne(id) {
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async create({ name, templateId, created_by = 'system' }) {
    if (!name || name.trim().length === 0) throw makeError('Il nome documento e obbligatorio', 400);

    const template = await templatesService.findOne(templateId);
    if (!template) throw makeError('Template non trovato', 404);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO documents
           (name, template_id, template_version, content, field_values, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6)
         RETURNING *`,
        [name.trim(), templateId, template.version, template.content, JSON.stringify({}), created_by],
      );

      const doc = result.rows[0];

      await client.query(
        `INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
         VALUES ($1, 1, $2, '{}', 'create', $3)`,
        [doc.id, template.content, created_by],
      );

      await client.query('COMMIT');
      await auditService.log('document', doc.id, 'create', created_by, {
        name,
        template_id: templateId,
      });
      return doc;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getFieldDefinitions(doc) {
    if (!doc.template_id) return [];
    const template = await templatesService.findOne(doc.template_id);
    return template?.fields || [];
  }

  async update(id, { name, content, fieldValues, created_by = 'system' }) {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const pool = getPool();
    const verResult = await pool.query(
      `SELECT MAX(version) AS max_version FROM document_versions WHERE document_id = $1`,
      [id],
    );
    const nextVersion = (parseInt(verResult.rows[0].max_version, 10) || 0) + 1;

    const newContent = content !== undefined ? content : existing.content;
    const newFieldValues = fieldValues !== undefined ? fieldValues : existing.field_values;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE documents
         SET name = $1, content = $2, field_values = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [name ? name.trim() : existing.name, newContent, JSON.stringify(newFieldValues), id],
      );

      await client.query(
        `INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
         VALUES ($1, $2, $3, $4, 'update', $5)`,
        [id, nextVersion, newContent, JSON.stringify(newFieldValues), created_by],
      );

      await client.query('COMMIT');
      await auditService.log('document', id, 'update', created_by, { version: nextVersion });
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async enqueuePdfGeneration(id, actor = 'system') {
    await ensureQueueRecovery(this.processPdfJob.bind(this));

    const doc = await this.findOne(id);
    if (!doc) throw makeError('Documento non trovato', 404);

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO pdf_jobs (document_id, status, requested_by)
       VALUES ($1, 'queued', $2)
       RETURNING *`,
      [id, actor],
    );

    const job = result.rows[0];

    enqueuePdfJob(async () => {
      await this.processPdfJob(job.id);
    });

    await auditService.log('document', id, 'enqueue_pdf', actor, { job_id: job.id });
    return job;
  }

  async processPdfJob(jobId) {
    const pool = getPool();
    const jobResult = await pool.query(`SELECT * FROM pdf_jobs WHERE id = $1`, [jobId]);
    const job = jobResult.rows[0];
    if (!job || job.status !== 'queued') return;

    await pool.query(
      `UPDATE pdf_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
      [jobId],
    );

    try {
      const doc = await this.findOne(job.document_id);
      if (!doc) throw makeError('Documento non trovato', 404);

      const fields = await this.getFieldDefinitions(doc);
      const { filename, unresolvedFields } = await pdfService.generatePdf(
        doc.content,
        doc.field_values || {},
        { title: doc.name, strict: true, fields },
      );

      await pool.query(
        `UPDATE pdf_jobs
         SET status = 'completed', filename = $1, unresolved_fields = $2, completed_at = NOW()
         WHERE id = $3`,
        [filename, JSON.stringify(unresolvedFields), jobId],
      );

      await pool.query(`UPDATE documents SET status = 'generated', updated_at = NOW() WHERE id = $1`, [doc.id]);

      await auditService.log('document', doc.id, 'generate_pdf_completed', job.requested_by, {
        job_id: jobId,
        filename,
        unresolved_fields: unresolvedFields,
      });
    } catch (err) {
      await pool.query(
        `UPDATE pdf_jobs
         SET status = 'failed', error = $1, completed_at = NOW()
         WHERE id = $2`,
        [err.message, jobId],
      );

      await auditService.log('document', job.document_id, 'generate_pdf_failed', job.requested_by, {
        job_id: jobId,
        error: err.message,
      });
    }
  }

  async getPdfJob(documentId, jobId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM pdf_jobs WHERE id = $1 AND document_id = $2`,
      [jobId, documentId],
    );
    return result.rows[0] || null;
  }

  async getCompletedPdfJob(documentId, jobId) {
    const job = await this.getPdfJob(documentId, jobId);
    if (!job) throw makeError('Job PDF non trovato', 404);
    if (job.status !== 'completed' || !job.filename) {
      throw makeError('PDF non ancora disponibile', 409);
    }
    return job;
  }

  async getLatestCompletedPdfJob(documentId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT *
       FROM pdf_jobs
       WHERE document_id = $1 AND status = 'completed' AND filename IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT 1`,
      [documentId],
    );

    if (!result.rows[0]) {
      throw makeError('Nessun PDF completato per questo documento', 404);
    }

    return result.rows[0];
  }

  async getPdfJobs(documentId) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM pdf_jobs WHERE document_id = $1 ORDER BY created_at DESC`,
      [documentId],
    );
    return result.rows;
  }

  async previewPdf(id) {
    const doc = await this.findOne(id);
    if (!doc) throw makeError('Documento non trovato', 404);

    const fields = await this.getFieldDefinitions(doc);
    const { filename } = await pdfService.generatePdf(doc.content, doc.field_values || {}, {
      title: doc.name,
      strict: false,
      fields,
    });

    return { filename };
  }

  async changeStatus(id, newStatus, actor = 'system') {
    const allowed = ['draft', 'generated', 'published', 'archived'];
    if (!allowed.includes(newStatus)) throw makeError('Stato non valido', 400);

    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const pool = getPool();
    await pool.query(`UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

    await auditService.log('document', id, 'status_change', actor, {
      from: existing.status,
      to: newStatus,
    });

    return { ...existing, status: newStatus };
  }

  async rename(id, newName, actor = 'system') {
    if (!newName || newName.trim().length === 0) throw makeError('Il nome non puo essere vuoto', 400);
    if (newName.trim().length > 255) throw makeError('Nome troppo lungo (max 255 caratteri)', 400);

    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const pool = getPool();
    const result = await pool.query(
      `UPDATE documents SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newName.trim(), id],
    );

    await auditService.log('document', id, 'rename', actor, {
      from: existing.name,
      to: newName.trim(),
    });
    return result.rows[0];
  }

  async restore(id, targetVersion, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const pool = getPool();
    const versionResult = await pool.query(
      `SELECT * FROM document_versions WHERE document_id = $1 AND version = $2`,
      [id, targetVersion],
    );

    if (versionResult.rows.length === 0) {
      throw makeError(`Versione ${targetVersion} non trovata`, 404);
    }

    const oldVersion = versionResult.rows[0];
    const verResult = await pool.query(
      `SELECT MAX(version) AS max_version FROM document_versions WHERE document_id = $1`,
      [id],
    );
    const nextVersion = (parseInt(verResult.rows[0].max_version, 10) || 0) + 1;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE documents
         SET content = $1, field_values = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [oldVersion.content, JSON.stringify(oldVersion.field_values), id],
      );

      await client.query(
        `INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id,
          nextVersion,
          oldVersion.content,
          JSON.stringify(oldVersion.field_values),
          `restore_from_v${targetVersion}`,
          actor,
        ],
      );

      await client.query('COMMIT');
      await auditService.log('document', id, 'restore', actor, {
        from_version: targetVersion,
        new_version: nextVersion,
      });
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getVersions(id) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, version, action, created_by, created_at
       FROM document_versions
       WHERE document_id = $1
       ORDER BY version DESC`,
      [id],
    );
    return result.rows;
  }

  async getVersionContent(id, version) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM document_versions WHERE document_id = $1 AND version = $2`,
      [id, version],
    );
    return result.rows[0] || null;
  }

  async delete(id, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Documento non trovato', 404);

    const pool = getPool();
    await pool.query(`DELETE FROM documents WHERE id = $1`, [id]);
    await auditService.log('document', id, 'delete', actor, { name: existing.name });
    return { deleted: true };
  }
}

module.exports = new DocumentsService();
