'use strict';

var utils = require('../utils/writer.js');
var Audit = require('../service/AuditService');

module.exports.auditController_findAll = function auditController_findAll(req, res, next, entityType, actor, fromDate, toDate, limit, offset) {
  Audit.auditController_findAll(entityType, actor, fromDate, toDate, limit, offset)
    .then(function(response) { utils.writeJson(res, response); })
    .catch(function(response) { utils.writeJson(res, response); });
};
