-- ═══════════════════════════════════════════════════════════════════════════════
-- MAC-Documents  |  Schema pulito
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- QUESTO FILE DESCRIVE LA STRUTTURA FINALE DEL DATABASE.
-- Non eseguire direttamente in produzione: usa le migration in db/migrations/.
-- Per un ambiente fresco puoi eseguirlo come bootstrap iniziale.
--
-- Ordine di esecuzione:
--   1. db/schema.sql                    ← questo file (ambienti nuovi)
--   2. db/migrations/                   ← aggiornamenti incrementali
--   3. db/seeds/001_seed_sample.sql     ← dati di esempio (opzionale)
--   4. db/seeds/fixtures/               ← solo ambienti dev/test
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── templates ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  content_path VARCHAR(500),
  status       VARCHAR(50)  NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'published')),
  version      INTEGER      NOT NULL DEFAULT 1,
  fields       JSONB        NOT NULL DEFAULT '[]',
  created_by   VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_status ON templates(status);
CREATE INDEX IF NOT EXISTS idx_templates_name   ON templates(name);


-- ─── template_versions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS template_versions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  UUID         NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version      INTEGER      NOT NULL,
  content_path VARCHAR(500),
  fields       JSONB        NOT NULL DEFAULT '[]',
  status       VARCHAR(50)  NOT NULL,
  action       VARCHAR(100) NOT NULL DEFAULT 'update',
  created_by   VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id
  ON template_versions(template_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_template_versions_unique_version
  ON template_versions(template_id, version);


-- ─── documents ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(255) NOT NULL,
  template_id      UUID         REFERENCES templates(id) ON DELETE SET NULL,
  template_version INTEGER      NOT NULL,
  content          TEXT         NOT NULL,
  field_values     JSONB        NOT NULL DEFAULT '{}',
  status           VARCHAR(50)  NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'generated', 'published', 'archived')),
  version          INTEGER      NOT NULL DEFAULT 1,
  created_by       VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_template_id ON documents(template_id);
CREATE INDEX IF NOT EXISTS idx_documents_status      ON documents(status);


-- ─── document_versions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version      INTEGER      NOT NULL,
  content      TEXT         NOT NULL,
  field_values JSONB        NOT NULL DEFAULT '{}',
  action       VARCHAR(100) NOT NULL DEFAULT 'update',
  created_by   VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id
  ON document_versions(document_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_versions_unique_version
  ON document_versions(document_id, version);


-- ─── pdf_jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID         NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  status            VARCHAR(50)  NOT NULL DEFAULT 'queued'
                                 CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  filename          VARCHAR(500),
  unresolved_fields JSONB        NOT NULL DEFAULT '[]',
  error_message     TEXT,
  requested_by      VARCHAR(255) NOT NULL DEFAULT 'system',
  created_by        VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_document_id ON pdf_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status      ON pdf_jobs(status);
