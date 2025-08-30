-- Migration: Remove notes column from plot_orders table
-- Date: 2025-01-01
-- Description: Remove the notes column from plot_orders table as it's no longer needed

-- Remove the notes column from plot_orders table
ALTER TABLE plot_orders DROP COLUMN IF EXISTS notes;

-- Update any existing records if needed (though notes column should be empty)
-- No additional data migration needed since we're just removing the column
