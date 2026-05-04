'use strict';

var utils = require('../utils/writer.js');
var Templates = require('../service/TemplatesService');

module.exports.templatesController_create = function(req, res, next, body) {
  Templates.templatesController_create(body).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_exportMd = function(req, res, next, id) {
  Templates.templatesController_exportMd(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_findAll = function(req, res, next, status, limit, offset) {
  Templates.templatesController_findAll(status, limit, offset).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_findOne = function(req, res, next, id) {
  Templates.templatesController_findOne(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_getVersionContent = function(req, res, next, id, version) {
  Templates.templatesController_getVersionContent(id, version).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_getVersions = function(req, res, next, id) {
  Templates.templatesController_getVersions(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_importFile = function(req, res, next) {
  Templates.templatesController_importFile().then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_publish = function(req, res, next, id) {
  Templates.templatesController_publish(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_remove = function(req, res, next, id) {
  Templates.templatesController_remove(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_restore = function(req, res, next, id, version) {
  Templates.templatesController_restore(id, version).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_update = function(req, res, next, id) {
  Templates.templatesController_update(id).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_validateFile = function(req, res, next) {
  Templates.templatesController_validateFile().then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
module.exports.templatesController_validateMd = function(req, res, next, body) {
  Templates.templatesController_validateMd(body).then(r => utils.writeJson(res, r)).catch(r => utils.writeJson(res, r));
};
