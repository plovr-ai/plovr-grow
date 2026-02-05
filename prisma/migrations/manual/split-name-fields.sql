-- Migration: Split name fields into firstName and lastName
-- This migration safely transforms existing data before schema changes

-- Step 1: Add new columns with temporary default values for Orders table
ALTER TABLE `orders`
  ADD COLUMN `customer_first_name` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `customer_last_name` VARCHAR(191) NOT NULL DEFAULT '';

-- Step 2: Populate new columns from existing customerName field for Orders
-- Split "John Doe" into firstName="John", lastName="Doe"
UPDATE `orders`
SET
  `customer_first_name` = TRIM(SUBSTRING_INDEX(`customer_name`, ' ', 1)),
  `customer_last_name` = TRIM(SUBSTRING(`customer_name`, LENGTH(SUBSTRING_INDEX(`customer_name`, ' ', 1)) + 1));

-- Step 3: Handle edge case where name has no space (single name)
UPDATE `orders`
SET `customer_last_name` = ''
WHERE `customer_last_name` = `customer_first_name`;

-- Step 4: Drop old customerName column from Orders
ALTER TABLE `orders` DROP COLUMN `customer_name`;

-- Step 5: Add new columns for LoyaltyMember table (nullable)
ALTER TABLE `loyalty_members`
  ADD COLUMN `first_name` VARCHAR(191) NULL,
  ADD COLUMN `last_name` VARCHAR(191) NULL;

-- Step 6: Populate new columns from existing name field for LoyaltyMembers
UPDATE `loyalty_members`
SET
  `first_name` = TRIM(SUBSTRING_INDEX(`name`, ' ', 1)),
  `last_name` = TRIM(SUBSTRING(`name`, LENGTH(SUBSTRING_INDEX(`name`, ' ', 1)) + 1))
WHERE `name` IS NOT NULL;

-- Step 7: Handle edge case for LoyaltyMembers with single name
UPDATE `loyalty_members`
SET `last_name` = NULL
WHERE `last_name` = `first_name` AND `name` IS NOT NULL;

-- Step 8: Drop old name column from LoyaltyMembers
ALTER TABLE `loyalty_members` DROP COLUMN `name`;

-- Step 9: Add new columns for CateringLead table
ALTER TABLE `catering_leads`
  ADD COLUMN `first_name` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `last_name` VARCHAR(191) NOT NULL DEFAULT '';

-- Step 10: Populate new columns from existing name field for CateringLeads
UPDATE `catering_leads`
SET
  `first_name` = TRIM(SUBSTRING_INDEX(`name`, ' ', 1)),
  `last_name` = TRIM(SUBSTRING(`name`, LENGTH(SUBSTRING_INDEX(`name`, ' ', 1)) + 1));

-- Step 11: Handle edge case for CateringLeads with single name
UPDATE `catering_leads`
SET `last_name` = ''
WHERE `last_name` = `first_name`;

-- Step 12: Drop old name column from CateringLeads
ALTER TABLE `catering_leads` DROP COLUMN `name`;

-- Migration complete! All name fields have been split into firstName and lastName
