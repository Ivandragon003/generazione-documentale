const documentsService = require('./documents.service');
const auditService = require('../audit/audit.service');
const { wrapAsync, validateUuidParam, getActor } = require('../common/http.utils');

function registerDocumentRoutes(router) {
  function parseVersionOrThrow(value) {
    const parsed = Number.parseInt(value, 10);
    if (!/^\d+$/.test(String(value)) || parsed <= 0) {
      throw { status: 400, message: 'version non valida' };
    }
    return parsed;
  }

  function parsePagination(query, defaults = { limit: 20, offset: 0 }) {
    const limitRaw = query.limit;
    const offsetRaw = query.offset;
    const limit = limitRaw === undefined ? defaults.limit : Number.parseInt(limitRaw, 10);
    const offset = offsetRaw === undefined ? defaults.offset : Number.parseInt(offsetRaw, 10);
    if (!Number.isInteger(limit) || limit <= 0) throw { status: 400, message: 'limit non valido' };
    if (!Number.isInteger(offset) || offset < 0) throw { status: 400, message: 'offset non valido' };
    return { limit, offset };
  }

  router.param('id', validateUuidParam('id', 'ID documento non valido'));

  router.get('/', wrapAsync(async (req, res) => {
    const { status } = req.query;
    const { limit, offset } = parsePagination(req.query);
    const result = await documentsService.findAll({
      status,
      limit,
      offset,
    });
    res.json(result);
  }));

  router.get('/:id', wrapAsync(async (req, res) => {
    const doc = await documentsService.findOne(req.params.id);
    if (!doc) throw { status: 404, message: 'Documento non trovato' };
    res.json(doc);
  }));

  router.post('/', wrapAsync(async (req, res) => {
    const { name, templateId } = req.body;
    if (!name) throw { status: 400, message: 'name e obbligatorio' };
    if (!templateId) throw { status: 400, message: 'templateId e obbligatorio' };

    const doc = await documentsService.create({
      name,
      templateId,
      created_by: getActor(req),
    });
    res.status(201).json(doc);
  }));

  router.put('/:id', wrapAsync(async (req, res) => {
    const { name, content, fieldValues } = req.body;
    if (fieldValues !== undefined && (fieldValues === null || typeof fieldValues !== 'object' || Array.isArray(fieldValues))) {
      throw { status: 400, message: 'fieldValues deve essere un oggetto' };
    }
    const doc = await documentsService.update(req.params.id, {
      name,
      content,
      fieldValues,
      created_by: getActor(req),
    });
    res.json(doc);
  }));

  router.patch('/:id/rename', wrapAsync(async (req, res) => {
    const { name } = req.body;
    if (!name) throw { status: 400, message: 'name e obbligatorio' };
    const doc = await documentsService.rename(req.params.id, name, getActor(req));
    res.json(doc);
  }));

  router.patch('/:id/status', wrapAsync(async (req, res) => {
    const { status } = req.body;
    if (!status) throw { status: 400, message: 'status e obbligatorio' };
    const doc = await documentsService.changeStatus(req.params.id, status, getActor(req));
    res.json(doc);
  }));

  router.post('/:id/generate-pdf', wrapAsync(async (req, res) => {
    const job = await documentsService.enqueuePdfGeneration(req.params.id, getActor(req));
    res.status(202).json({
      message: 'Generazione PDF accodata',
      jobId: job.id,
      status: job.status,
      documentId: job.document_id,
    });
  }));

  router.get('/:id/pdf-jobs', wrapAsync(async (req, res) => {
    const doc = await documentsService.findOne(req.params.id);
    if (!doc) throw { status: 404, message: 'Documento non trovato' };
    const jobs = await documentsService.getPdfJobs(req.params.id);
    res.json(jobs);
  }));

  router.get('/:id/pdf-jobs/:jobId', wrapAsync(async (req, res) => {
    const job = await documentsService.getPdfJob(req.params.id, req.params.jobId);
    if (!job) throw { status: 404, message: 'Job PDF non trovato' };
    res.json(job);
  }));

  router.get('/:id/pdf-jobs/:jobId/download', wrapAsync(async (req, res, next) => {
    const job = await documentsService.getCompletedPdfJob(req.params.id, req.params.jobId);
    const pdfService = require('./pdf.service');
    const stream = await pdfService.getPdfStream(job.filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    stream.on('error', next);
    stream.pipe(res);
  }));

  router.get('/:id/latest-pdf', wrapAsync(async (req, res, next) => {
    const job = await documentsService.getLatestCompletedPdfJob(req.params.id);
    const pdfService = require('./pdf.service');
    const stream = await pdfService.getPdfStream(job.filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
    stream.on('error', next);
    stream.pipe(res);
  }));

  router.get('/:id/preview-pdf', wrapAsync(async (req, res, next) => {
    const { filename } = await documentsService.previewPdf(req.params.id);
    const pdfService = require('./pdf.service');
    const stream = await pdfService.getPdfStream(filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview-temporanea.pdf"');
    stream.on('error', next);
    stream.pipe(res);
    stream.on('end', () => {
      pdfService.deletePdf(filename).catch(() => {});
    });
  }));

  router.get('/:id/versions', wrapAsync(async (req, res) => {
    const doc = await documentsService.findOne(req.params.id);
    if (!doc) throw { status: 404, message: 'Documento non trovato' };
    const versions = await documentsService.getVersions(req.params.id);
    res.json(versions);
  }));

  router.get('/:id/versions/:version', wrapAsync(async (req, res) => {
    const version = parseVersionOrThrow(req.params.version);
    const v = await documentsService.getVersionContent(req.params.id, version);
    if (!v) throw { status: 404, message: 'Versione non trovata' };
    res.json(v);
  }));

  router.post('/:id/restore/:version', wrapAsync(async (req, res) => {
    const version = parseVersionOrThrow(req.params.version);
    const doc = await documentsService.restore(
      req.params.id,
      version,
      getActor(req),
    );
    res.json(doc);
  }));

  router.get('/:id/export-md', wrapAsync(async (req, res) => {
    const doc = await documentsService.findOne(req.params.id);
    if (!doc) throw { status: 404, message: 'Documento non trovato' };
    const safeName = doc.name.replace(/[^a-z0-9_\-]/gi, '_');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.md"`);
    res.send(doc.content);
  }));

  router.get('/:id/audit', wrapAsync(async (req, res) => {
    const { limit, offset } = parsePagination(req.query, { limit: 50, offset: 0 });
    const logs = await auditService.findByEntity('document', req.params.id, {
      limit,
      offset,
    });
    res.json(logs);
  }));

  router.delete('/:id', wrapAsync(async (req, res) => {
    const result = await documentsService.delete(req.params.id, getActor(req));
    res.json(result);
  }));

  return router;
}

module.exports = { registerDocumentRoutes };
