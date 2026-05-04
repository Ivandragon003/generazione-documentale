'use strict';

var utils = require('../utils/writer.js');
var Dev = require('../service/DevService');

module.exports.devController_executeTestRun = function devController_executeTestRun(req, res, next) {
  Dev.devController_executeTestRun()
    .then(function(response) { utils.writeJson(res, response); })
    .catch(function(response) { utils.writeJson(res, response); });
};

module.exports.devController_reset = function devController_reset(req, res, next, xResetConfirm) {
  Dev.devController_reset(xResetConfirm)
    .then(function(response) { utils.writeJson(res, response); })
    .catch(function(response) { utils.writeJson(res, response); });
};

module.exports.devController_seedLargePdf = function devController_seedLargePdf(req, res, next) {
  Dev.devController_seedLargePdf()
    .then(function(response) { utils.writeJson(res, response); })
    .catch(function(response) { utils.writeJson(res, response); });
};
