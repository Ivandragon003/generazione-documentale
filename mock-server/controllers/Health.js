'use strict';

var utils = require('../utils/writer.js');
var Health = require('../service/HealthService');

module.exports.healthController_check = function healthController_check(req, res, next) {
  Health.healthController_check()
    .then(function(response) { utils.writeJson(res, response); })
    .catch(function(response) { utils.writeJson(res, response); });
};
