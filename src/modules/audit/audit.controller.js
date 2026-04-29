const auditService = require('./audit.service');
const { wrapAsync } = require('../common/http.utils');

function registerAuditRoutes(router) {
  function parsePagination(query) {
    const limitRaw = query.limit;
    const offsetRaw = query.offset;
    const limit = limitRaw === undefined ? 50 : Number.parseInt(limitRaw, 10);
    const offset = offsetRaw === undefined ? 0 : Number.parseInt(offsetRaw, 10);
    if (!Number.isInteger(limit) || limit <= 0) throw { status: 400, message: 'limit non valido' };
    if (!Number.isInteger(offset) || offset < 0) throw { status: 400, message: 'offset non valido' };
    return { limit, offset };
  }

  // GET /audit
  router.get('/', wrapAsync(async (req, res) => {
    const { entityType, actor, fromDate, toDate } = req.query;
    const { limit, offset } = parsePagination(req.query);
    const logs = await auditService.findAll({
      entityType,
      actor,
      fromDate,
      toDate,
      limit,
      offset,
    });
    res.json(logs);
  }));

  return router;
}

module.exports = { registerAuditRoutes };
