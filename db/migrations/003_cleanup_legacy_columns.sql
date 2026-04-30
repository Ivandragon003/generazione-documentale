-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 003 — Pulizia colonne/tabelle legacy
-- Creato:  2026-02-01
-- Autore:  sistema
-- ═══════════════════════════════════════════════════════════════════════════════
-- Rimuove residui di versioni precedenti dello schema:
--   - Tabella packages (rimpiazzata da pdf_jobs)
--   - Colonne legacy su templates, template_versions, documents
--   - Indice obsoleto su templates(parent_id)
--   - Marca come 'failed' i job rimasti appesi al riavvio dell'app
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Rimozione tabella e colonna di riferimento obsolete
ALTER TABLE documents    DROP COLUMN IF EXISTS package_id;
DROP TABLE  IF EXISTS packages;

-- 2. Rimozione colonne legacy su templates
DROP INDEX  IF EXISTS idx_templates_parent_id;
ALTER TABLE templates    DROP COLUMN IF EXISTS parent_id;
ALTER TABLE templates    DROP COLUMN IF EXISTS content;

-- 3. Rimozione colonne legacy su template_versions
ALTER TABLE template_versions DROP COLUMN IF EXISTS content;

-- 4. Rimozione colonne PDF inline su documents
--    (la gestione PDF è ora delegata alla tabella pdf_jobs)
ALTER TABLE documents    DROP COLUMN IF EXISTS locked_by;
ALTER TABLE documents    DROP COLUMN IF EXISTS locked_at;
ALTER TABLE documents    DROP COLUMN IF EXISTS pdf_path;
ALTER TABLE documents    DROP COLUMN IF EXISTS pdf_generated_at;
ALTER TABLE documents    DROP COLUMN IF EXISTS pdf_status;
ALTER TABLE documents    DROP COLUMN IF EXISTS pdf_deleted_at;

-- 5. Pulizia job rimasti in stato transitorio al riavvio dell'app
--    (da eseguire anche all'avvio dell'applicazione via migrations/run.js)
UPDATE pdf_jobs
SET    status = 'failed',
       error  = 'Job interrotto dal riavvio applicazione'
WHERE  status IN ('queued', 'running');
