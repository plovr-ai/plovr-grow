-- Migration: Add company_id to orders table
-- Date: 2026-01-26

-- Step 1: Add company_id column (nullable first)
ALTER TABLE orders ADD COLUMN company_id VARCHAR(191) NULL AFTER tenant_id;

-- Step 2: Update company_id for orders with merchant_id
UPDATE orders o
JOIN merchants m ON o.merchant_id = m.id
SET o.company_id = m.company_id
WHERE o.merchant_id IS NOT NULL;

-- Step 3: Update company_id for orders without merchant_id (e.g., giftcards)
-- Get company_id from tenant's company
UPDATE orders o
JOIN companies c ON o.tenant_id = c.tenant_id
SET o.company_id = c.id
WHERE o.merchant_id IS NULL;

-- Step 4: Make company_id NOT NULL (all orders should have company_id now)
ALTER TABLE orders MODIFY COLUMN company_id VARCHAR(191) NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE orders
ADD CONSTRAINT orders_company_id_foreign
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Step 6: Add index on company_id
CREATE INDEX orders_company_id_idx ON orders(company_id);
