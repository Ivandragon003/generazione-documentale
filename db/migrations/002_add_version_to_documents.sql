-- Migration 002: aggiunge colonna version a documents (mancava nella v1 del DB)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
