const templatesService = require('./templates.service');
const { wrapAsync, validateUuidParam, getActor, readAndCleanupUpload } = require('../common/http.utils');

const UPLOAD_PATH = process.env.UPLOAD_PATH || './storage/uploads';
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

// Registra le route Express-style su un router (NestJS compatibile via modulo)
function registerTemplateRoutes(router) {
  const multer = require('multer');
  const upload = multer({
    dest: UPLOAD_PATH,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (req, file, cb) => {
      if (file.originalname.endsWith('.md') || file.mimetype === 'text/markdown' || file.mimetype === 'text/plain') {
        cb(null, true);
      } else {
        cb(new Error('Formato file non supportato. Accettati: .md'), false);
      }
    },
  });

  function parseVersionOrThrow(value) {
    const parsed = Number.parseInt(value, 10);
    if (!/^\d+$/.test(String(value)) || parsed <= 0) {
      throw { status: 400, message: 'version non valida' };
    }
    return parsed;
  }

  function parsePagination(query) {
    const limitRaw = query.limit;
    const offsetRaw = query.offset;
    const limit = limitRaw === undefined ? 20 : Number.parseInt(limitRaw, 10);
    const offset = offsetRaw === undefined ? 0 : Number.parseInt(offsetRaw, 10);
    if (!Number.isInteger(limit) || limit <= 0) throw { status: 400, message: 'limit non valido' };
    if (!Number.isInteger(offset) || offset < 0) throw { status: 400, message: 'offset non valido' };
    return { limit, offset };
  }

  router.param('id', validateUuidParam('id', 'ID template non valido'));

  // GET /templates
  router.get('/', wrapAsync(async (req, res) => {
    const { status } = req.query;
    const { limit, offset } = parsePagination(req.query);
    const result = await templatesService.findAll({
      status,
      limit,
      offset,
    });
    res.json(result);
  }));

  // GET /templates/:id
  router.get('/:id', wrapAsync(async (req, res) => {
    const template = await templatesService.findOne(req.params.id);
    if (!template) throw { status: 404, message: 'Template non trovato' };
    res.json(template);
  }));

  // GET /templates/:id/versions
  router.get('/:id/versions', wrapAsync(async (req, res) => {
    const template = await templatesService.findOne(req.params.id);
    if (!template) throw { status: 404, message: 'Template non trovato' };
    const versions = await templatesService.getVersions(req.params.id);
    res.json(versions);
  }));

  // GET /templates/:id/versions/:version
  router.get('/:id/versions/:version', wrapAsync(async (req, res) => {
    const version = parseVersionOrThrow(req.params.version);
    const content = await templatesService.getVersionContent(req.params.id, version);
    if (!content) throw { status: 404, message: 'Versione non trovata' };
    res.json(content);
  }));

  // POST /templates
  // application/json -> create standard
  // multipart/form-data -> import da file .md
  router.post('/', upload.single('file'), wrapAsync(async (req, res) => {
    const createdBy = getActor(req);
    const isMultipart = req.is('multipart/form-data');

    if (isMultipart) {
      if (!req.file) throw { status: 400, message: 'File mancante' };

      const content = readAndCleanupUpload(req.file);
      const name = req.body.name || req.file.originalname.replace('.md', '');
      const template = await templatesService.importFromMarkdown(content, name, createdBy);
      return res.status(201).json(template);
    }

    const { name, description, content, fields } = req.body;
    if (!name) throw { status: 400, message: 'name è obbligatorio' };
    if (!content) throw { status: 400, message: 'content è obbligatorio' };

    const template = await templatesService.create({
      name,
      description,
      content,
      fields,
      created_by: createdBy,
    });
    res.status(201).json(template);
  }));

  // POST /templates/validate-md
  router.post('/validate-md', wrapAsync(async (req, res) => {
    const { content } = req.body;
    res.json(templatesService.validateMarkdown(content));
  }));

  // POST /templates/validate-file -> valida un .md caricato senza creare template
  router.post('/validate-file', upload.single('file'), wrapAsync(async (req, res) => {
    if (!req.file) throw { status: 400, message: 'File mancante' };

    const content = readAndCleanupUpload(req.file);

    res.json({
      filename: req.file.originalname,
      ...templatesService.validateMarkdown(content),
    });
  }));

  // PUT /templates/:id
  router.put('/:id', wrapAsync(async (req, res) => {
    const { name, description, content, fields } = req.body;
    const template = await templatesService.update(req.params.id, {
      name,
      description,
      content,
      fields,
      created_by: getActor(req),
    });
    res.json(template);
  }));

  // POST /templates/:id/publish
  router.post('/:id/publish', wrapAsync(async (req, res) => {
    const template = await templatesService.publish(req.params.id, getActor(req));
    res.json(template);
  }));

  // POST /templates/:id/restore/:version
  router.post('/:id/restore/:version', wrapAsync(async (req, res) => {
    const version = parseVersionOrThrow(req.params.version);
    const template = await templatesService.restore(
      req.params.id,
      version,
      getActor(req),
    );
    res.json(template);
  }));

  // GET /templates/:id/export -> scarica il file .md
  router.get('/:id/export', wrapAsync(async (req, res) => {
    const template = await templatesService.findOne(req.params.id);
    if (!template) throw { status: 404, message: 'Template non trovato' };

    const content = templatesService.getExportContent(template);
    const safeName = template.name.replace(/[^a-z0-9_\-]/gi, '_');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_v${template.version}.md"`);
    res.send(content);
  }));

  // DELETE /templates/:id
  router.delete('/:id', wrapAsync(async (req, res) => {
    const result = await templatesService.delete(req.params.id, getActor(req));
    res.json(result);
  }));

  return router;
}

module.exports = { registerTemplateRoutes };
