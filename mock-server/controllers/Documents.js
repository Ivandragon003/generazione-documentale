'use strict';

var utils = require('../utils/writer.js');
var Documents = require('../service/DocumentsService');

module.exports.documentsController_changeStatus = function(req, res, next, id) {
  Documents.documentsController_changeStatus(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_create = function(req, res, next, body) {
  Documents.documentsController_create(body).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_downloadPdf = function(req, res, next, id, jobId) {
  Documents.documentsController_downloadPdf(id, jobId).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_exportMd = function(req, res, next, id) {
  Documents.documentsController_exportMd(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_findAll = function(req, res, next, status, limit, offset) {
  Documents.documentsController_findAll(status, limit, offset).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_findOne = function(req, res, next, id) {
  Documents.documentsController_findOne(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_generatePdf = function(req, res, next, id) {
  Documents.documentsController_generatePdf(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_getAudit = function(req, res, next, id, limit, offset) {
  Documents.documentsController_getAudit(id, limit, offset).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_getPdfJob = function(req, res, next, id, jobId) {
  Documents.documentsController_getPdfJob(id, jobId).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_getPdfJobs = function(req, res, next, id) {
  Documents.documentsController_getPdfJobs(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_getVersionContent = function(req, res, next, id, version) {
  Documents.documentsController_getVersionContent(id, version).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_getVersions = function(req, res, next, id) {
  Documents.documentsController_getVersions(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_latestPdf = function(req, res, next, id) {
  Documents.documentsController_latestPdf(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_previewPdf = function(req, res, next, id) {
  Documents.documentsController_previewPdf(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_remove = function(req, res, next, id) {
  Documents.documentsController_remove(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_rename = function(req, res, next, id) {
  Documents.documentsController_rename(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_restoreVersion = function(req, res, next, id, version) {
  Documents.documentsController_restoreVersion(id, version).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.documentsController_update = function(req, res, next, id) {
  Documents.documentsController_update(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
