
-- Supports the standalone find-service: it needs to know which catalog
-- connector produced a source (to re-test it later) and whether the
-- connection was genuinely wired or simulated.

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS connector_id TEXT,
  ADD COLUMN IF NOT EXISTS integration_mode TEXT;
