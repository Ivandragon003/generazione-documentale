'use strict';

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4, validate: isUuid } = require('uuid');
const { Injectable }        = require('@nestjs/common');
const { getPool, withTransaction } = require('../../database/database');
const { AuditService }      = require('../audit/audit.service');
const { makeError }         = require('../common/http.utils');
const q = require('./templates.queries');

const fsp = fs.promises;
const TEMPLATE_STORAGE_PATH = process.env.TEMPLATE_STORAGE_PATH || './storage/templates';
const MAX_TEMPLATE_CONTENT_BYTES = Math.max(
  parseInt(process.env.MAX_TEMPLATE_CONTENT_BYTES || '200000', 10), 1000,
);

// ─── helpers puri ─────────────────────────────────────────────────────────────

function assertValidUuid(id) {
  if (!id || !isUuid(id)) throw makeError(`ID non valido: deve essere un UUID v4 (es. 550e8400-e29b-41d4-a716-446655440000)`, 400);
}

function extractFields(content) {
  const regex = /\{\{(\w+)\}\}/g;
  const fields = new Set();
  let match;
  while ((match = regex.exec(content)) !== null) fields.add(match[1]);
  return Array.from(fields);
}

function labelFromName(name) {
  return name.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function normalizeFieldDefinitions(content, providedFields = []) {
  const placeholders = extractFields(content);
  const providedByName = new Map(
    (Array.isArray(providedFields) ? providedFields : [])
      .map((f) => (typeof f === 'string' ? { name: f } : f))
      .filter((f) => f && f.name)
      .map((f) => [f.name, f]),
  );
  return placeholders.map((name) => {
    const provided = providedByName.get(name) || {};
    return {
      name,
      label:        provided.label        || labelFromName(name),
      type:         provided.type         || 'text',
      required:     provided.required !== undefined ? Boolean(provided.required) : true,
      defaultValue: provided.defaultValue !== undefined ? provided.defaultValue : '',
    };
  });
}

function validateMarkdownContent(content) {
  const errors   = [];
  const warnings = [];

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    errors.push('Il contenuto del template non puo essere vuoto');
    return { valid: false, errors, warnings, fields: [] };
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_TEMPLATE_CONTENT_BYTES) {
    errors.push(`Template troppo grande. Limite: ${MAX_TEMPLATE_CONTENT_BYTES} byte`);
  }

  const matches = content.match(/\{\{(\w+)\}\}/g) || [];
  const fieldCounts = new Map();
  for (const placeholder of matches) {
    const name = placeholder.slice(2, -2);
    fieldCounts.set(name, (fieldCounts.get(name) || 0) + 1);
  }
  const fields = Array.from(fieldCounts.keys());
  const duplicateFields = fields.filter((f) => fieldCounts.get(f) > 1);
  const invalidPlaceholders = content.match(/\{\{[^}\n]*\}\}/g)?.filter((p) => !/^\{\{\w+\}\}$/.test(p)) || [];

  const open  = (content.match(/\{\{/g) || []).length;
  const close = (content.match(/\}\}/g) || []).length;
  if (open !== close) errors.push('Ci sono parentesi placeholder non bilanciate: controlla {{ e }}');
  if (invalidPlaceholders.length > 0) errors.push(`Placeholder non validi: ${Array.from(new Set(invalidPlaceholders)).join(', ')}`);

  const blockedPatterns = [
    { pattern: /\\(?:input|include|write18|openout|read)\b/i, label: 'comandi LaTeX di input/output' },
    { pattern: /<script\b/i, label: 'tag script HTML' },
    { pattern: /<iframe\b/i, label: 'tag iframe HTML' },
  ];
  const blocked = blockedPatterns.filter(({ pattern }) => pattern.test(content)).map(({ label }) => label);
  if (blocked.length > 0) errors.push(`Contenuto non consentito per sicurezza: ${blocked.join(', ')}`);

  if (fields.length === 0)      warnings.push('Nessun campo dinamico trovato. Usa placeholder come {{titolo}}');
  if (!/^#\s+.+/m.test(content)) warnings.push('Nessun titolo Markdown H1 trovato. Aggiungi una riga tipo # {{titolo}}');
  if (duplicateFields.length > 0) warnings.push(`Campi ripetuti nel template: ${duplicateFields.join(', ')}`);

  return { valid: errors.length === 0, errors, warnings, fields: normalizeFieldDefinitions(content) };
}

function validateContent(content) {
  const result = validateMarkdownContent(content);
  if (!result.valid) throw makeError(result.errors.join('; '), 400);
}

// ─── filesystem helpers ───────────────────────────────────────────────────────

function getTemplateRelativePath(templateId, version) {
  return path.join(templateId, `v${version}.md`).replace(/\\/g, '/');
}

async function writeTemplateFile(templateId, version, content) {
  await fsp.mkdir(path.join(TEMPLATE_STORAGE_PATH, templateId), { recursive: true });
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
  if (row.content_path) return { ...row, content: await readTemplateFile(row.content_path) };
  throw new Error('File contenuto template non configurato');
}

// ─── Service ──────────────────────────────────────────────────────────────────

class TemplatesService {
  constructor(auditService) {
    this.auditService = auditService;
  }

  // Helper interno: valida UUID + findOne + 404 se non trovato
  async _findOneOrThrow(id) {
    assertValidUuid(id);
    const t = await this.findOne(id);
    if (!t) throw makeError('Template non trovato', 404);
    return t;
  }

  async findAll({ status, limit = 20, offset = 0 } = {}) {
    const { data, total } = await q.findAll({ status, limit, offset });
    return { data, total, limit, offset };
  }

  async findOne(id) {
    assertValidUuid(id);
    return hydrateContent(await q.findById(id));
  }

  async create({ name, description, content, fields: providedFields, created_by = 'system' }) {
    validateContent(content);
    if (!name || name.trim().length === 0) throw makeError('Il nome del template e obbligatorio', 400);

    const id     = uuidv4();
    const fields = normalizeFieldDefinitions(content, providedFields);
    const contentPath = await writeTemplateFile(id, 1, content);

    const template = await withTransaction(getPool(), async (client) => {
      const t = await q.insertTemplate(client, {
        id, name: name.trim(), description, contentPath, fields, createdBy: created_by,
      });
      await q.insertTemplateVersion(client, {
        templateId: t.id, version: 1, contentPath, fields,
        status: 'draft', action: 'create', createdBy: created_by,
      });
      return t;
    });

    await this.auditService.log('template', template.id, 'create', created_by, { name });
    return hydrateContent(template);
  }

  async update(id, { name, description, content, fields: providedFields, created_by = 'system' }) {
    const existing = await this._findOneOrThrow(id);
    if (existing.status === 'published') {
      throw makeError('Un template pubblicato non puo essere modificato. Crea una nuova versione.', 409);
    }

    if (content) validateContent(content);
    const newContent  = content || existing.content;
    const fields      = normalizeFieldDefinitions(newContent, providedFields || existing.fields);
    const newVersion  = existing.version + 1;
    const contentPath = await writeTemplateFile(id, newVersion, newContent);

    const updated = await withTransaction(getPool(), async (client) => {
      const t = await q.updateTemplate(client, {
        id,
        name:        name ? name.trim() : existing.name,
        description: description !== undefined ? description : existing.description,
        contentPath, fields, newVersion,
      });
      await q.insertTemplateVersion(client, {
        templateId: id, version: newVersion, contentPath, fields,
        status: existing.status, action: 'update', createdBy: created_by,
      });
      return t;
    });

    await this.auditService.log('template', id, 'update', created_by, { version: newVersion });
    return hydrateContent(updated);
  }

  async publish(id, actor = 'system') {
    const existing = await this._findOneOrThrow(id);
    if (existing.status === 'published') throw makeError('Template gia pubblicato', 409);
    await q.publishTemplate(id);
    await this.auditService.log('template', id, 'publish', actor, { version: existing.version });
    return { ...existing, status: 'published' };
  }

  async restore(id, targetVersion, actor = 'system') {
    const existing   = await this._findOneOrThrow(id);
    const versionRow = await q.findVersionById(id, targetVersion);
    if (!versionRow) throw makeError(`Versione ${targetVersion} non trovata`, 404);

    const oldVersion  = await hydrateContent(versionRow);
    const newVersion  = existing.version + 1;
    const fields      = normalizeFieldDefinitions(oldVersion.content, oldVersion.fields);
    const contentPath = await writeTemplateFile(id, newVersion, oldVersion.content);

    const restored = await withTransaction(getPool(), async (client) => {
      const t = await q.restoreTemplate(client, { id, contentPath, fields, newVersion });
      await q.insertTemplateVersion(client, {
        templateId: id, version: newVersion, contentPath, fields,
        status: 'draft', action: `restore_from_v${targetVersion}`, createdBy: actor,
      });
      return t;
    });

    await this.auditService.log('template', id, 'restore', actor, {
      from_version: targetVersion, new_version: newVersion,
    });
    return hydrateContent(restored);
  }

  async getVersions(id)               { return q.findVersions(id); }
  async getVersionContent(id, version) { return hydrateContent(await q.findVersionById(id, version)); }

  async delete(id, actor = 'system') {
    const existing = await this._findOneOrThrow(id);
    const activeCount = await q.countActiveDocuments(id);
    if (activeCount > 0) throw makeError('Impossibile eliminare: esistono documenti attivi basati su questo template', 409);
    await q.deleteTemplate(id);
    await fsp.rm(path.join(TEMPLATE_STORAGE_PATH, id), { recursive: true, force: true });
    await this.auditService.log('template', id, 'delete', actor, { name: existing.name });
    return { deleted: true };
  }

  getExportContent(template)               { return template.content; }
  async importFromMarkdown(content, name, created_by = 'system') {
    validateContent(content);
    return this.create({ name, content, created_by });
  }
  validateMarkdown(content) { return validateMarkdownContent(content); }
}

Injectable()(TemplatesService);
module.exports = { TemplatesService };
