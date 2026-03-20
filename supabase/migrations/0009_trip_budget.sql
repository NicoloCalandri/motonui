-- =============================================================================
-- motonui — Trip Budget
-- Migration: 0009_trip_budget.sql
-- Adds: budget_eur column to trips table
-- =============================================================================

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS budget_eur NUMERIC(12, 2);
