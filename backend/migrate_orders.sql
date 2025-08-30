-- Migration script to update plot_orders table to new simplified schema
-- This script safely migrates existing data and updates the table structure

-- Step 1: Create a backup of existing data (optional but recommended)
CREATE TABLE IF NOT EXISTS plot_orders_backup AS
SELECT * FROM plot_orders;

-- Step 2: Add new columns
ALTER TABLE plot_orders
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Step 3: Migrate data from customer_name to first_name and last_name
-- Split customer_name by space - first part goes to first_name, rest to last_name
UPDATE plot_orders
SET
    first_name = CASE
        WHEN customer_name IS NOT NULL AND customer_name != ''
        THEN split_part(customer_name, ' ', 1)
        ELSE 'Unknown'
    END,
    last_name = CASE
        WHEN customer_name IS NOT NULL AND customer_name != ''
        THEN CASE
            WHEN array_length(string_to_array(customer_name, ' '), 1) > 1
            THEN array_to_string((string_to_array(customer_name, ' '))[2:], ' ')
            ELSE ''
        END
        ELSE 'Unknown'
    END
WHERE first_name IS NULL OR last_name IS NULL;

-- Step 4: Make new columns NOT NULL (after data migration)
ALTER TABLE plot_orders
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;

-- Step 5: Drop old columns that are no longer needed
ALTER TABLE plot_orders
DROP COLUMN IF EXISTS customer_name,
DROP COLUMN IF EXISTS customer_id_number,
DROP COLUMN IF EXISTS intended_use,
DROP COLUMN IF EXISTS notes;

-- Step 6: Drop old index
DROP INDEX IF EXISTS idx_plot_orders_customer_id_number;

-- Step 7: Verify the migration
SELECT
    'Migration completed successfully' as status,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN first_name IS NOT NULL AND last_name IS NOT NULL THEN 1 END) as migrated_orders
FROM plot_orders;
