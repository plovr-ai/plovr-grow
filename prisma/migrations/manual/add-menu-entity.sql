-- Manual Migration: Add Menu entity and migrate existing data
-- Run this script manually before applying schema changes

-- Step 1: Create menus table
CREATE TABLE IF NOT EXISTS `menus` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `company_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `menus_tenant_id_idx` (`tenant_id`),
  INDEX `menus_company_id_idx` (`company_id`),
  INDEX `menus_company_id_sort_order_idx` (`company_id`, `sort_order`),
  CONSTRAINT `menus_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  CONSTRAINT `menus_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Step 2: Create default menu for each company that has categories
INSERT INTO `menus` (`id`, `tenant_id`, `company_id`, `name`, `sort_order`, `status`, `created_at`, `updated_at`)
SELECT
  UUID() as `id`,
  `tenant_id`,
  `company_id`,
  'Main Menu' as `name`,
  0 as `sort_order`,
  'active' as `status`,
  NOW() as `created_at`,
  NOW() as `updated_at`
FROM `menu_categories`
GROUP BY `tenant_id`, `company_id`;

-- Step 3: Add menu_id column to menu_categories (nullable first)
ALTER TABLE `menu_categories` ADD COLUMN `menu_id` VARCHAR(36);

-- Step 4: Update menu_categories to link to their company's default menu
UPDATE `menu_categories` mc
JOIN `menus` m ON mc.`company_id` = m.`company_id`
SET mc.`menu_id` = m.`id`;

-- Step 5: Make menu_id NOT NULL and add foreign key
ALTER TABLE `menu_categories`
  MODIFY COLUMN `menu_id` VARCHAR(36) NOT NULL,
  ADD INDEX `menu_categories_menu_id_idx` (`menu_id`),
  ADD CONSTRAINT `menu_categories_menu_id_fkey` FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON DELETE CASCADE;
