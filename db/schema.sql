-- ═══════════════════════════════════════════════════════════════
-- MAC-Documents | Schema Lean Gerarchico
-- Portfolio / Programma / Progetto → Sections → Templates → Documents
-- ═══════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────
-- CATEGORIES (Portfolio / Programma / Progetto)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- dominio esplicito (più chiaro di un nome libero)
  type        VARCHAR(50) NOT NULL
             CHECK (type IN ('portfolio', 'programma', 'progetto')),

  name        VARCHAR(100) NOT NULL,

  -- nome unico dentro ogni tipo
  UNIQUE(type, name)
);


-- ───────────────────────────────────────────────────────────────
-- SECTIONS (cartelle logiche dentro ogni categoria)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category_id  UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,

  name         VARCHAR(255) NOT NULL,
  position     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sections_category_id
ON sections(category_id);


-- ───────────────────────────────────────────────────────────────
-- TEMPLATES (struttura documento)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  section_id   UUID REFERENCES sections(id) ON DELETE SET NULL,

  name         VARCHAR(255) NOT NULL,
  description  TEXT,

  content_path VARCHAR(500),

  status       VARCHAR(50) NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft', 'published')),

  fields       JSONB NOT NULL DEFAULT '[]',

  created_by   VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_section_id
ON templates(section_id);

CREATE INDEX IF NOT EXISTS idx_templates_status
ON templates(status);


-- ───────────────────────────────────────────────────────────────
-- DOCUMENTS (istanze runtime compilate)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name             VARCHAR(255) NOT NULL,

  template_id      UUID REFERENCES templates(id) ON DELETE SET NULL,

  content          TEXT NOT NULL,

  field_values     JSONB NOT NULL DEFAULT '{}',

  status           VARCHAR(50) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'generated', 'published', 'archived')),

  created_by       VARCHAR(255) NOT NULL DEFAULT 'system',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_template_id
ON documents(template_id);

CREATE INDEX IF NOT EXISTS idx_documents_status
ON documents(status);


-- ───────────────────────────────────────────────────────────────
-- PDF JOBS (pipeline asincrona)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  status            VARCHAR(50) NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued', 'running', 'completed', 'failed')),

  filename          VARCHAR(500),

  unresolved_fields JSONB NOT NULL DEFAULT '[]',
  error_message     TEXT,

  requested_by      VARCHAR(255) NOT NULL DEFAULT 'system',

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_document_id
ON pdf_jobs(document_id);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status
ON pdf_jobs(status);