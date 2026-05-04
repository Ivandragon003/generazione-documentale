'use strict';

var utils = require('../utils/writer.js');
var Pdf = require('../service/PdfService');

module.exports.pdfController_validateTemplate = function pdfController_validateTemplate(req, res, next, templateId) {
  Pdf.pdfController_validateTemplate(templateId)
    .then(function(response) { utils.writeJson(res, response); })
    .catch(function(response) { utils.writeJson(res, response); });
};
