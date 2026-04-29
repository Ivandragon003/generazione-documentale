const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../../database');
const auditService = require('../audit/audit.service');

const fsp = fs.promises;
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || './storage/templates';
const MAX_TEMPLATE_CONTENT_BYTES = Math.max(parseInt(process.env.MAX_TEMPLATE_CONTENT_BYTES || '200000', 10), 1000);

function makeError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function extractFields(content) {
  const regex = /\{\{(\w+)\}\}/g;
  const fields = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) {
    fields.add(match[1]);
  }
  return Array.from(fields);
}

function labelFromName(name) {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeFieldDefinitions(content, providedFields = []) {
  const placeholders = extractFields(content);
  const providedByName = new Map(
    (Array.isArray(providedFields) ? providedFields : [])
      .map((field) => (typeof field === 'string' ? { name: field } : field))
      .filter((field) => field && field.name)
      .map((field) => [field.name, field]),
  );

  return placeholders.map((name) => {
    const provided = providedByName.get(name) || {};
    return {
      name,
      label: provided.label || labelFromName(name),
      type: provided.type || 'text',
      required: provided.required !== undefined ? Boolean(provided.required) : true,
      defaultValue: provided.defaultValue !== undefined ? provided.defaultValue : '',
    };
  });
}

function validateMarkdownContent(content) {
  const errors = [];
  const warnings = [];

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    errors.push('Il contenuto del template non puo essere vuoto');
    return { valid: false, errors, warnings, fields: [] };
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_TEMPLATE_CONTENT_BYTES) {
    errors.push(`Template troppo grande. Limite: ${MAX_TEMPLATE_CONTENT_BYTES} byte`);
  }

  const fields = extractFields(content);
  const duplicateFields = fields.filter((field) => {
    const matches = content.match(new RegExp(`\\{\\{${field}\\}\\}`, 'g')) || [];
    return matches.length > 1;
  });
  const invalidPlaceholders = content.match(/\{\{[^}\n]*\}\}/g)
    ?.filter((placeholder) => !/^\{\{\w+\}\}$/.test(placeholder)) || [];
  const danglingOpen = (content.match(/\{\{/g) || []).length;
  const danglingClose = (content.match(/\}\}/g) || []).length;

  if (danglingOpen !== danglingClose) {
    errors.push('Ci sono parentesi placeholder non bilanciate: controlla {{ e }}');
  }

  if (invalidPlaceholders.length > 0) {
    errors.push(`Placeholder non validi: ${Array.from(new Set(invalidPlaceholders)).join(', ')}`);
  }

  const blockedPatterns = [
    { pattern: /\\(?:input|include|write18|openout|read)\b/i, label: 'comandi LaTeX di input/output' },
    { pattern: /<script\b/i, label: 'tag script HTML' },
    { pattern: /<iframe\b/i, label: 'tag iframe HTML' },
  ];

  const blocked = blockedPatterns
    .filter(({ pattern }) => pattern.test(content))
    .map(({ label }) => label);

  if (blocked.length > 0) {
    errors.push(`Contenuto non consentito per sicurezza: ${blocked.join(', ')}`);
  }

  if (fields.length === 0) {
    warnings.push('Nessun campo dinamico trovato. Usa placeholder come {{titolo}}');
  }

  if (!/^#\s+.+/m.test(content)) {
    warnings.push('Nessun titolo Markdown H1 trovato. Aggiungi una riga tipo # {{titolo}}');
  }

  if (duplicateFields.length > 0) {
    warnings.push(`Campi ripetuti nel template: ${duplicateFields.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fields: normalizeFieldDefinitions(content),
  };
}

function validateContent(content) {
  const result = validateMarkdownContent(content);
  if (!result.valid) {
    throw makeError(result.errors.join('; '), 400);
  }
}

async function ensureTemplateStorageDir(templateId) {
  await fsp.mkdir(path.join(TEMPLATE_STORAGE_PATH, templateId), { recursive: true });
}

function getTemplateRelativePath(templateId, version) {
  return path.join(templateId, `v${version}.md`).replace(/\\/g, '/');
}

async function writeTemplateFile(templateId, version, content) {
  await ensureTemplateStorageDir(templateId);
  const relativePath = getTemplateRelativePath(templateId, version);
  await fsp.writeFile(path.join(TEMPLATE_STORAGE_PATH, relativePath), content, 'utf8');
  return relativePath;
}

async function readTemplateFile(contentPath) {
  if (!contentPath) return null;
  return fsp.readFile(path.join(TEMPLATE_STORAGE_PATH, contentPath), 'utf8');
}

async function hydrateContent(row) {
  if (!row) return null;
  if (row.content_path) {
    return { ...row, content: await readTemplateFile(row.content_path) };
  }
  throw new Error('File contenuto template non configurato');
}

class TemplatesService {
  async findAll({ status, limit = 20, offset = 0 } = {}) {
    const pool = getPool();
    const params = [];
    let where = '';

    if (status) {
      where = 'WHERE status = $1';
      params.push(status);
    }

    params.push(limit, offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const result = await pool.query(
      `SELECT id, name, description, status, version, fields, content_path, created_by, created_at, updated_at
       FROM templates
       ${where}
       ORDER BY updated_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM templates ${where}`,
      status ? [status] : [],
    );

    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit,
      offset,
    };
  }

  async findOne(id) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, name, description, content_path, status, version,
              fields, created_by, created_at, updated_at
       FROM templates
       WHERE id = $1`,
      [id],
    );
    return hydrateContent(result.rows[0] || null);
  }

  async create({ name, description, content, fields: providedFields, created_by = 'system' }) {
    validateContent(content);
    if (!name || name.trim().length === 0) {
      throw makeError('Il nome del template e obbligatorio', 400);
    }

    const id = uuidv4();
    const fields = normalizeFieldDefinitions(content, providedFields);
    const contentPath = await writeTemplateFile(id, 1, content);
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
         VALUES ($1, $2, $3, $4, 'draft', 1, $5, $6)
         RETURNING *`,
        [id, name.trim(), description || null, contentPath, JSON.stringify(fields), created_by],
      );

      const template = result.rows[0];

      await client.query(
        `INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
         VALUES ($1, 1, $2, $3, 'draft', 'create', $4)`,
        [template.id, contentPath, JSON.stringify(fields), created_by],
      );

      await client.query('COMMIT');

      await auditService.log('template', template.id, 'create', created_by, { name });
      return hydrateContent(template);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id, { name, description, content, fields: providedFields, created_by = 'system' }) {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Template non trovato', 404);

    if (existing.status === 'published') {
      throw makeError('Un template pubblicato non puo essere modificato. Crea una nuova versione.', 409);
    }

    if (content) validateContent(content);

    const newContent = content || existing.content;
    const fields = normalizeFieldDefinitions(newContent, providedFields || existing.fields);
    const newVersion = existing.version + 1;
    const contentPath = await writeTemplateFile(id, newVersion, newContent);
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE templates
         SET name = $1, description = $2, content_path = $3,
             fields = $4, version = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          name ? name.trim() : existing.name,
          description !== undefined ? description : existing.description,
          contentPath,
          JSON.stringify(fields),
          newVersion,
          id,
        ],
      );

      await client.query(
        `INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
         VALUES ($1, $2, $3, $4, $5, 'update', $6)`,
        [id, newVersion, contentPath, JSON.stringify(fields), existing.status, created_by],
      );

      await client.query('COMMIT');

      await auditService.log('template', id, 'update', created_by, { version: newVersion });
      return hydrateContent(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async publish(id, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Template non trovato', 404);
    if (existing.status === 'published') throw makeError('Template gia pubblicato', 409);

    const pool = getPool();
    await pool.query(
      `UPDATE templates SET status = 'published', updated_at = NOW() WHERE id = $1`,
      [id],
    );

    await auditService.log('template', id, 'publish', actor, { version: existing.version });
    return { ...existing, status: 'published' };
  }

  async restore(id, targetVersion, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Template non trovato', 404);

    const pool = getPool();
    const versionResult = await pool.query(
      `SELECT * FROM template_versions WHERE template_id = $1 AND version = $2`,
      [id, targetVersion],
    );

    if (versionResult.rows.length === 0) {
      throw makeError(`Versione ${targetVersion} non trovata`, 404);
    }

    const oldVersion = await hydrateContent(versionResult.rows[0]);
    const newVersion = existing.version + 1;
    const fields = normalizeFieldDefinitions(oldVersion.content, oldVersion.fields);
    const contentPath = await writeTemplateFile(id, newVersion, oldVersion.content);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE templates
         SET content_path = $1, fields = $2, version = $3,
             status = 'draft', updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [contentPath, JSON.stringify(fields), newVersion, id],
      );

      await client.query(
        `INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6)`,
        [
          id,
          newVersion,
          contentPath,
          JSON.stringify(fields),
          `restore_from_v${targetVersion}`,
          actor,
        ],
      );

      await client.query('COMMIT');

      await auditService.log('template', id, 'restore', actor, {
        from_version: targetVersion,
        new_version: newVersion,
      });

      return hydrateContent(result.rows[0]);
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
      `SELECT id, version, status, action, content_path, created_by, created_at
       FROM template_versions
       WHERE template_id = $1
       ORDER BY version DESC`,
      [id],
    );
    return result.rows;
  }

  async getVersionContent(id, version) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM template_versions WHERE template_id = $1 AND version = $2`,
      [id, version],
    );
    return hydrateContent(result.rows[0] || null);
  }

  async delete(id, actor = 'system') {
    const existing = await this.findOne(id);
    if (!existing) throw makeError('Template non trovato', 404);

    const pool = getPool();
    const docs = await pool.query(
      `SELECT COUNT(*) FROM documents WHERE template_id = $1 AND status != 'archived'`,
      [id],
    );
    if (parseInt(docs.rows[0].count, 10) > 0) {
      throw makeError('Impossibile eliminare: esistono documenti attivi basati su questo template', 409);
    }

    await pool.query(`DELETE FROM templates WHERE id = $1`, [id]);
    await fsp.rm(path.join(TEMPLATE_STORAGE_PATH, id), { recursive: true, force: true });
    await auditService.log('template', id, 'delete', actor, { name: existing.name });
    return { deleted: true };
  }

  getExportContent(template) {
    return template.content;
  }

  async importFromMarkdown(content, name, created_by = 'system') {
    validateContent(content);
    return this.create({ name, content, created_by });
  }

  validateMarkdown(content) {
    return validateMarkdownContent(content);
  }
}

module.exports = new TemplatesService();
