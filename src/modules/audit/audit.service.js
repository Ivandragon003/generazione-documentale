'use strict';

const { Injectable } = require('@nestjs/common');
const q = require('./audit.queries');

class AuditService {
  async log(entityType, entityId, action, actor = 'system', metadata = null) {
    try {
      await q.insertLog(entityType, entityId, action, actor, metadata);
    } catch (err) {
      // L'audit log non deve bloccare l'operazione principale
      console.error(`Audit log failed: ${err.message}`);
    }
  }

  async findByEntity(entityType, entityId, { limit = 50, offset = 0 } = {}) {
    return q.findByEntity(entityType, entityId, { limit, offset });
  }

  /**
   * Restituisce { data, total, limit, offset } coerente con gli altri moduli.
   */
  async findAll({ entityType, actor, fromDate, toDate, limit = 50, offset = 0 } = {}) {
    const { data, total } = await q.findAll({ entityType, actor, fromDate, toDate, limit, offset });
    return { data, total, limit, offset };
  }
}

Injectable()(AuditService);

module.exports = { AuditService };