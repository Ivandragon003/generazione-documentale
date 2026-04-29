const templatesService = require('../templates/templates.service');
const { wrapAsync } = require('../common/http.utils');

function registerPdfRoutes(router) {
  // POST /pdf/templates/:templateId/validate
  router.post('/templates/:templateId/validate', wrapAsync(async (req, res) => {
    const template = await templatesService.findOne(req.params.templateId);
    if (!template) {
      throw { status: 404, message: 'Template non trovato' };
    }

    const isAvailable = template.status === 'published' || template.status === 'draft';
    res.json({
      templateId: template.id,
      valid: isAvailable,
      available: isAvailable,
      status: template.status,
      version: template.version,
      fields: template.fields || [],
    });
  }));

  return router;
}

module.exports = { registerPdfRoutes };
