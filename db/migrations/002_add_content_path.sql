-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002 — Aggiunta colonna content_path
-- Creato:  2026-01-15
-- Autore:  sistema
-- ═══════════════════════════════════════════════════════════════════════════════
-- Aggiunge content_path a templates e template_versions se non presente.
-- Idempotente grazie a IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE templates
  ADD COLUMN IF NOT EXISTS content_path VARCHAR(500);

ALTER TABLE template_versions
  ADD COLUMN IF NOT EXISTS content_path VARCHAR(500);
