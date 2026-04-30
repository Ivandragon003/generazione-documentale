-- ═══════════════════════════════════════════════════════════════════════════════
-- Fixtures DEV/TEST — 001
-- ═══════════════════════════════════════════════════════════════════════════════
-- ATTENZIONE: Solo ambienti dev/test. MAI in produzione.
--
-- Inserisce le fixture con UUID fissi usati dalla suite di regression test
-- (DevController.reset) e dalla collection Postman.
--
-- UUID fissi (definiti anche in src/modules/dev/dev.controller.js):
--   Template stabile:     11111111-1111-4111-8111-111111111111
--   Template eliminabile: 11111111-1111-4111-8111-111111111112
--   Documento fixture:    22222222-2222-4222-8222-222222222222
--   PDF job fixture:      33333333-3333-4333-8333-333333333333
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Pulizia completa prima dell'inserimento ──────────────────────────────────
TRUNCATE TABLE
  audit_log,
  pdf_jobs,
  document_versions,
  documents,
  template_versions,
  templates
RESTART IDENTITY CASCADE;

-- ─── Template stabile ────────────────────────────────────────────────────────
INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Template Fixture', 'Template stabile per collection API',
  '11111111-1111-4111-8111-111111111111/v1.md', 'draft', 1,
  '[{"name":"titolo","label":"Titolo","type":"text","required":true,"defaultValue":""},{"name":"cliente","label":"Cliente","type":"text","required":true,"defaultValue":""},{"name":"importo","label":"Importo","type":"text","required":true,"defaultValue":""},{"name":"data","label":"Data","type":"date","required":true,"defaultValue":""}]'::jsonb,
  'dev-fixture'
);

INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
VALUES ('11111111-1111-4111-8111-111111111111', 1, '11111111-1111-4111-8111-111111111111/v1.md',
  '[{"name":"titolo","label":"Titolo","type":"text","required":true,"defaultValue":""},{"name":"cliente","label":"Cliente","type":"text","required":true,"defaultValue":""},{"name":"importo","label":"Importo","type":"text","required":true,"defaultValue":""},{"name":"data","label":"Data","type":"date","required":true,"defaultValue":""}]'::jsonb,
  'draft', 'create_fixture', 'dev-fixture'
);

-- ─── Template eliminabile ─────────────────────────────────────────────────────
INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
VALUES (
  '11111111-1111-4111-8111-111111111112',
  'Template Fixture Delete', 'Template eliminabile per collection API',
  '11111111-1111-4111-8111-111111111112/v1.md', 'draft', 1,
  '[{"name":"titolo","label":"Titolo","type":"text","required":true,"defaultValue":""},{"name":"cliente","label":"Cliente","type":"text","required":true,"defaultValue":""},{"name":"importo","label":"Importo","type":"text","required":true,"defaultValue":""},{"name":"data","label":"Data","type":"date","required":true,"defaultValue":""}]'::jsonb,
  'dev-fixture'
);

INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
VALUES ('11111111-1111-4111-8111-111111111112', 1, '11111111-1111-4111-8111-111111111112/v1.md',
  '[{"name":"titolo","label":"Titolo","type":"text","required":true,"defaultValue":""},{"name":"cliente","label":"Cliente","type":"text","required":true,"defaultValue":""},{"name":"importo","label":"Importo","type":"text","required":true,"defaultValue":""},{"name":"data","label":"Data","type":"date","required":true,"defaultValue":""}]'::jsonb,
  'draft', 'create_fixture', 'dev-fixture'
);

-- ─── Documento fixture ────────────────────────────────────────────────────────
INSERT INTO documents (id, name, template_id, template_version, content, field_values, status, version, created_by)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'Documento Fixture', '11111111-1111-4111-8111-111111111111', 1,
  E'# Documento fixture\n\nCliente: Cliente fixture\nImporto: 1000\nData: 2026-04-29\n',
  '{"titolo":"Documento fixture","cliente":"Cliente fixture","importo":"1000","data":"2026-04-29"}'::jsonb,
  'draft', 1, 'dev-fixture'
);

INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
VALUES ('22222222-2222-4222-8222-222222222222', 1,
  E'# Documento fixture\n\nCliente: Cliente fixture\nImporto: 1000\nData: 2026-04-29\n',
  '{"titolo":"Documento fixture","cliente":"Cliente fixture","importo":"1000","data":"2026-04-29"}'::jsonb,
  'create_fixture', 'dev-fixture'
);

-- ─── PDF job fixture (completato) ─────────────────────────────────────────────
INSERT INTO pdf_jobs (id, document_id, status, filename, requested_by, created_by, completed_at)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222',
  'completed', 'fixture-completed.pdf',
  'dev-fixture', 'dev-fixture', NOW()
);
