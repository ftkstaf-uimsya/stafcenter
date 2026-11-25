-- ==============================================================================
-- Migration 011: Add procurement_year & acquisition_cost to office_kit_items
-- ==============================================================================

ALTER TABLE public.office_kit_items
  ADD COLUMN IF NOT EXISTS procurement_year INTEGER
    CHECK (procurement_year IS NULL OR (procurement_year >= 1990 AND procurement_year <= 2100)),
  ADD COLUMN IF NOT EXISTS acquisition_cost BIGINT NOT NULL DEFAULT 0
    CHECK (acquisition_cost >= 0);
