-- Migration: Remove intended_use column from plot_orders table
-- Date: 2025-01-01
-- Description: Remove the intended_use column since it's redundant with plot data

-- Remove the intended_use column from plot_orders table
ALTER TABLE plot_orders DROP COLUMN IF EXISTS intended_use;

-- Remove the check constraint for intended_use if it exists
ALTER TABLE plot_orders DROP CONSTRAINT IF EXISTS plot_orders_intended_use_check;
