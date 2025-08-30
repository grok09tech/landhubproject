-- Add customer_username column to plot_orders table
-- Migration: 20250823000000_add_customer_username_to_plot_orders

-- Add the customer_username column
ALTER TABLE plot_orders
ADD COLUMN customer_username text NOT NULL DEFAULT '';

-- Add unique constraint on customer_username
ALTER TABLE plot_orders
ADD CONSTRAINT plot_orders_customer_username_unique UNIQUE (customer_username);

-- Add index on customer_username for better performance
CREATE INDEX IF NOT EXISTS idx_plot_orders_customer_username ON plot_orders (customer_username);

-- Update existing records with a default username based on customer name
-- This will be replaced when users update their orders
UPDATE plot_orders
SET customer_username = LOWER(REPLACE(REPLACE(customer_name, ' ', '_'), '''', ''))
WHERE customer_username = '';

-- Make customer_username NOT NULL after setting defaults
ALTER TABLE plot_orders
ALTER COLUMN customer_username SET NOT NULL;

-- Add validation for customer_username format (alphanumeric, underscore, hyphen)
ALTER TABLE plot_orders
ADD CONSTRAINT plot_orders_customer_username_format
CHECK (customer_username ~ '^[a-zA-Z0-9_-]{3,}$');
