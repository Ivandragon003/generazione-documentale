-- ═══════════════════════════════════════════════════════════════════════════════
-- Seed 001 — Dati di esempio realistici
-- ═══════════════════════════════════════════════════════════════════════════════
-- Inserisce template e documenti di esempio per ambienti di sviluppo locale.
-- NON eseguire in produzione.
-- Esecuzione sicura: usa ON CONFLICT DO NOTHING per idempotenza.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Pulizia preventiva (opzionale — decommentare se necessario) ──────────────
-- TRUNCATE TABLE audit_log, pdf_jobs, document_versions, documents,
--               template_versions, templates RESTART IDENTITY CASCADE;

-- ─── Template 1: Contratto di fornitura ──────────────────────────────────────
INSERT INTO templates (
  id, name, description, content_path, status, version, fields, created_by
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Contratto di Fornitura',
  'Template standard per contratti di fornitura beni e servizi',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/v1.md',
  'published',
  1,
  '[
    {"name":"fornitore",    "label":"Fornitore",          "type":"text", "required":true,  "defaultValue":""},
    {"name":"cliente",      "label":"Cliente",            "type":"text", "required":true,  "defaultValue":""},
    {"name":"oggetto",      "label":"Oggetto fornitura",  "type":"text", "required":true,  "defaultValue":""},
    {"name":"importo",      "label":"Importo (€)",        "type":"text", "required":true,  "defaultValue":""},
    {"name":"data_inizio",  "label":"Data inizio",        "type":"date", "required":true,  "defaultValue":""},
    {"name":"data_fine",    "label":"Data fine",          "type":"date", "required":true,  "defaultValue":""},
    {"name":"note",         "label":"Note aggiuntive",    "type":"text", "required":false, "defaultValue":""}
  ]'::jsonb,
  'admin'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_versions (
  template_id, version, content_path, fields, status, action, created_by
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  1,
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/v1.md',
  '[{"name":"fornitore","label":"Fornitore","type":"text","required":true,"defaultValue":""},{"name":"cliente","label":"Cliente","type":"text","required":true,"defaultValue":""},{"name":"oggetto","label":"Oggetto fornitura","type":"text","required":true,"defaultValue":""},{"name":"importo","label":"Importo (€)","type":"text","required":true,"defaultValue":""},{"name":"data_inizio","label":"Data inizio","type":"date","required":true,"defaultValue":""},{"name":"data_fine","label":"Data fine","type":"date","required":true,"defaultValue":""},{"name":"note","label":"Note aggiuntive","type":"text","required":false,"defaultValue":""}]'::jsonb,
  'published', 'create', 'admin'
) ON CONFLICT DO NOTHING;

-- ─── Template 2: Capitolato tecnico ──────────────────────────────────────────
INSERT INTO templates (
  id, name, description, content_path, status, version, fields, created_by
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Capitolato Tecnico',
  'Template per capitolati tecnici di progetto',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/v1.md',
  'published', 1,
  '[{"name":"progetto","label":"Nome progetto","type":"text","required":true,"defaultValue":""},{"name":"committente","label":"Committente","type":"text","required":true,"defaultValue":""},{"name":"responsabile","label":"Responsabile","type":"text","required":true,"defaultValue":""},{"name":"budget","label":"Budget stimato","type":"text","required":true,"defaultValue":""},{"name":"durata_mesi","label":"Durata (mesi)","type":"text","required":true,"defaultValue":""},{"name":"requisiti","label":"Requisiti tecnici","type":"text","required":true,"defaultValue":""},{"name":"deliverable","label":"Deliverable","type":"text","required":false,"defaultValue":""}]'::jsonb,
  'admin'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/v1.md',
  '[{"name":"progetto","label":"Nome progetto","type":"text","required":true,"defaultValue":""},{"name":"committente","label":"Committente","type":"text","required":true,"defaultValue":""},{"name":"responsabile","label":"Responsabile","type":"text","required":true,"defaultValue":""},{"name":"budget","label":"Budget stimato","type":"text","required":true,"defaultValue":""},{"name":"durata_mesi","label":"Durata (mesi)","type":"text","required":true,"defaultValue":""},{"name":"requisiti","label":"Requisiti tecnici","type":"text","required":true,"defaultValue":""},{"name":"deliverable","label":"Deliverable","type":"text","required":false,"defaultValue":""}]'::jsonb,
  'published', 'create', 'admin'
) ON CONFLICT DO NOTHING;

-- ─── Template 3: Verbale di riunione (draft) ─────────────────────────────────
INSERT INTO templates (id, name, description, content_path, status, version, fields, created_by)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Verbale di Riunione', 'Template bozza per verbali di riunione interna',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc/v1.md', 'draft', 1,
  '[{"name":"data_riunione","label":"Data riunione","type":"date","required":true,"defaultValue":""},{"name":"partecipanti","label":"Partecipanti","type":"text","required":true,"defaultValue":""},{"name":"argomenti","label":"Argomenti trattati","type":"text","required":true,"defaultValue":""},{"name":"decisioni","label":"Decisioni prese","type":"text","required":true,"defaultValue":""},{"name":"prossima_data","label":"Prossima riunione","type":"date","required":false,"defaultValue":""}]'::jsonb,
  'mario.rossi'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO template_versions (template_id, version, content_path, fields, status, action, created_by)
VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc/v1.md',
  '[{"name":"data_riunione","label":"Data riunione","type":"date","required":true,"defaultValue":""},{"name":"partecipanti","label":"Partecipanti","type":"text","required":true,"defaultValue":""},{"name":"argomenti","label":"Argomenti trattati","type":"text","required":true,"defaultValue":""},{"name":"decisioni","label":"Decisioni prese","type":"text","required":true,"defaultValue":""},{"name":"prossima_data","label":"Prossima riunione","type":"date","required":false,"defaultValue":""}]'::jsonb,
  'draft', 'create', 'mario.rossi'
) ON CONFLICT DO NOTHING;

-- ─── Documento 1 — Contratto Acme ────────────────────────────────────────────
INSERT INTO documents (id, name, template_id, template_version, content, field_values, status, version, created_by)
VALUES (
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  'Contratto Fornitura Acme S.r.l.',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 1,
  E'# Contratto di Fornitura\n\n**Fornitore:** TechSolutions S.r.l.\n**Cliente:** Acme S.r.l.\n\n## Oggetto\n\nFornitura di servizi di sviluppo software per piattaforma documentale.\n\n## Importo\n\n€ 24.500,00 + IVA\n\n## Durata\n\nDal 2026-02-01 al 2026-07-31',
  '{"fornitore":"TechSolutions S.r.l.","cliente":"Acme S.r.l.","oggetto":"Servizi sviluppo software","importo":"24500","data_inizio":"2026-02-01","data_fine":"2026-07-31","note":""}'::jsonb,
  'published', 1, 'luigi.bianchi'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
VALUES ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 1,
  E'# Contratto di Fornitura\n\n**Fornitore:** TechSolutions S.r.l.\n**Cliente:** Acme S.r.l.',
  '{"fornitore":"TechSolutions S.r.l.","cliente":"Acme S.r.l.","oggetto":"Servizi sviluppo software","importo":"24500","data_inizio":"2026-02-01","data_fine":"2026-07-31","note":""}'::jsonb,
  'create', 'luigi.bianchi'
) ON CONFLICT DO NOTHING;

-- ─── Documento 2 — Capitolato Beta ───────────────────────────────────────────
INSERT INTO documents (id, name, template_id, template_version, content, field_values, status, version, created_by)
VALUES (
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'Capitolato Progetto Beta 2026',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 1,
  E'# Capitolato Tecnico — Progetto Beta 2026\n\n**Committente:** Regione Campania\n**Responsabile:** Ing. Marco Esposito\n\n## Budget\n\n€ 85.000,00\n\n## Durata\n\n8 mesi',
  '{"progetto":"Beta 2026","committente":"Regione Campania","responsabile":"Ing. Marco Esposito","budget":"85000","durata_mesi":"8","requisiti":"API REST NestJS, Frontend React, Deploy Docker","deliverable":"Documentazione, codice sorgente, collaudo"}'::jsonb,
  'draft', 1, 'marco.esposito'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (document_id, version, content, field_values, action, created_by)
VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 1,
  E'# Capitolato Tecnico — Progetto Beta 2026',
  '{"progetto":"Beta 2026","committente":"Regione Campania","responsabile":"Ing. Marco Esposito","budget":"85000","durata_mesi":"8","requisiti":"API REST NestJS, Frontend React, Deploy Docker","deliverable":""}'::jsonb,
  'create', 'marco.esposito'
) ON CONFLICT DO NOTHING;

-- ─── Audit log di esempio ────────────────────────────────────────────────────
INSERT INTO audit_log (entity_type, entity_id, action, actor, metadata) VALUES
  ('template', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'create',  'admin',          '{"name":"Contratto di Fornitura"}'),
  ('template', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'publish', 'admin',          '{"version":1}'),
  ('template', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'create',  'admin',          '{"name":"Capitolato Tecnico"}'),
  ('template', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'publish', 'admin',          '{"version":1}'),
  ('template', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'create',  'mario.rossi',    '{"name":"Verbale di Riunione"}'),
  ('document', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'create',  'luigi.bianchi',  '{"name":"Contratto Fornitura Acme S.r.l."}'),
  ('document', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'publish', 'luigi.bianchi',  '{"status":"published"}'),
  ('document', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'create',  'marco.esposito', '{"name":"Capitolato Progetto Beta 2026"}');
