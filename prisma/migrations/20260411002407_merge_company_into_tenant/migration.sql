/*
  Warnings:

  - You are about to drop the column `company_id` on the `company_order_sequences` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `featured_items` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `gift_cards` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `loyalty_configs` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `loyalty_members` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `menu_categories` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `menu_items` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `menus` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `merchants` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `stripe_customers` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `tax_configs` table. All the data in the column will be lost.
  - You are about to drop the column `company_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `companies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_reset_tokens` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[tenant_id,date]` on the table `company_order_sequences` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,menu_item_id]` on the table `featured_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id]` on the table `loyalty_configs` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenant_id,phone]` on the table `loyalty_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `tenants` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `company_order_sequences_company_id_idx` ON `company_order_sequences`;

-- DropIndex
DROP INDEX `company_order_sequences_tenant_id_company_id_date_key` ON `company_order_sequences`;

-- DropIndex
DROP INDEX `featured_items_company_id_idx` ON `featured_items`;

-- DropIndex
DROP INDEX `featured_items_company_id_menu_item_id_key` ON `featured_items`;

-- DropIndex
DROP INDEX `gift_cards_company_id_idx` ON `gift_cards`;

-- DropIndex
DROP INDEX `loyalty_configs_company_id_key` ON `loyalty_configs`;

-- DropIndex
DROP INDEX `loyalty_configs_tenant_id_idx` ON `loyalty_configs`;

-- DropIndex
DROP INDEX `loyalty_members_company_id_idx` ON `loyalty_members`;

-- DropIndex
DROP INDEX `loyalty_members_tenant_id_company_id_phone_key` ON `loyalty_members`;

-- DropIndex
DROP INDEX `menu_categories_company_id_idx` ON `menu_categories`;

-- DropIndex
DROP INDEX `menu_categories_company_id_sort_order_idx` ON `menu_categories`;

-- DropIndex
DROP INDEX `menu_items_company_id_idx` ON `menu_items`;

-- DropIndex
DROP INDEX `menu_items_company_id_status_idx` ON `menu_items`;

-- DropIndex
DROP INDEX `menus_company_id_idx` ON `menus`;

-- DropIndex
DROP INDEX `menus_company_id_sort_order_idx` ON `menus`;

-- DropIndex
DROP INDEX `merchants_company_id_idx` ON `merchants`;

-- DropIndex
DROP INDEX `orders_company_id_idx` ON `orders`;

-- DropIndex
DROP INDEX `stripe_customers_company_id_idx` ON `stripe_customers`;

-- DropIndex
DROP INDEX `tax_configs_company_id_idx` ON `tax_configs`;

-- DropIndex
DROP INDEX `tax_configs_company_id_status_idx` ON `tax_configs`;

-- DropIndex
DROP INDEX `users_company_id_idx` ON `users`;

-- AlterTable
ALTER TABLE `company_order_sequences` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `featured_items` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `gift_cards` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `loyalty_configs` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `loyalty_members` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `menu_categories` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `menu_items` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `menus` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `merchants` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `orders` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `stripe_customers` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `tax_configs` DROP COLUMN `company_id`;

-- AlterTable
ALTER TABLE `tenants` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `locale` VARCHAR(191) NOT NULL DEFAULT 'en-US',
    ADD COLUMN `logo_url` VARCHAR(191) NULL,
    ADD COLUMN `onboarding_completed_at` DATETIME(3) NULL,
    ADD COLUMN `onboarding_data` JSON NULL,
    ADD COLUMN `onboarding_status` VARCHAR(191) NOT NULL DEFAULT 'not_started',
    ADD COLUMN `settings` JSON NULL,
    ADD COLUMN `slug` VARCHAR(191) NULL,
    ADD COLUMN `source` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    ADD COLUMN `support_email` VARCHAR(191) NULL,
    ADD COLUMN `support_phone` VARCHAR(191) NULL,
    ADD COLUMN `timezone` VARCHAR(191) NOT NULL DEFAULT 'America/New_York',
    ADD COLUMN `website_url` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `company_id`;

-- DropTable
DROP TABLE `companies`;

-- DropTable
DROP TABLE `password_reset_tokens`;

-- CreateIndex
CREATE UNIQUE INDEX `company_order_sequences_tenant_id_date_key` ON `company_order_sequences`(`tenant_id`, `date`);

-- CreateIndex
CREATE UNIQUE INDEX `featured_items_tenant_id_menu_item_id_key` ON `featured_items`(`tenant_id`, `menu_item_id`);

-- CreateIndex
CREATE UNIQUE INDEX `loyalty_configs_tenant_id_key` ON `loyalty_configs`(`tenant_id`);

-- CreateIndex
CREATE UNIQUE INDEX `loyalty_members_tenant_id_phone_key` ON `loyalty_members`(`tenant_id`, `phone`);

-- CreateIndex
CREATE INDEX `menu_categories_tenant_id_sort_order_idx` ON `menu_categories`(`tenant_id`, `sort_order`);

-- CreateIndex
CREATE INDEX `menu_items_tenant_id_status_idx` ON `menu_items`(`tenant_id`, `status`);

-- CreateIndex
CREATE INDEX `menus_tenant_id_sort_order_idx` ON `menus`(`tenant_id`, `sort_order`);

-- CreateIndex
CREATE INDEX `tax_configs_tenant_id_status_idx` ON `tax_configs`(`tenant_id`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `tenants_slug_key` ON `tenants`(`slug`);

-- CreateIndex
CREATE INDEX `tenants_slug_idx` ON `tenants`(`slug`);
