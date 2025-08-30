-- Migration: Update plot_orders table to use first_name and last_name
-- Date: 2024-01-01
-- Description: Update plot_orders table to match new simplified order form

-- Add new columns
ALTER TABLE plot_orders
ADD COLUMN first_name text,
ADD COLUMN last_name text;

-- Update existing records to split customer_name into first_name and last_name
-- For existing records, we'll put the full name in first_name and leave last_name empty
UPDATE plot_orders
SET first_name = customer_name,
    last_name = ''
WHERE first_name IS NULL;

-- Make new columns NOT NULL
ALTER TABLE plot_orders
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL;

-- Make customer_email NOT NULL
UPDATE plot_orders
SET customer_email = ''
WHERE customer_email IS NULL;

ALTER TABLE plot_orders
ALTER COLUMN customer_email SET NOT NULL;

-- Drop old columns
ALTER TABLE plot_orders
DROP COLUMN customer_name,
DROP COLUMN customer_username,
DROP COLUMN customer_id_number;

-- Drop old indexes
DROP INDEX IF EXISTS idx_plot_orders_customer_username;
DROP INDEX IF EXISTS idx_plot_orders_customer_id;

-- Add new indexes
CREATE INDEX IF NOT EXISTS idx_plot_orders_first_name ON plot_orders (first_name);
CREATE INDEX IF NOT EXISTS idx_plot_orders_last_name ON plot_orders (last_name);
CREATE INDEX IF NOT EXISTS idx_plot_orders_customer_email ON plot_orders (customer_email);
