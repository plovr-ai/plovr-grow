/*
  Warnings:

  - You are about to drop the column `subscription_plan` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `subscription_status` on the `tenants` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenant_id,product_line]` on the table `subscriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `subscriptions_stripe_customer_id_key` ON `subscriptions`;

-- DropIndex
DROP INDEX `subscriptions_tenant_id_key` ON `subscriptions`;

-- AlterTable
ALTER TABLE `subscriptions` ADD COLUMN `product_line` VARCHAR(191) NOT NULL DEFAULT 'platform',
    MODIFY `plan` VARCHAR(191) NOT NULL DEFAULT 'free';

-- AlterTable
ALTER TABLE `tenants` DROP COLUMN `subscription_plan`,
    DROP COLUMN `subscription_status`;

-- CreateIndex
CREATE UNIQUE INDEX `subscriptions_tenant_id_product_line_key` ON `subscriptions`(`tenant_id`, `product_line`);

-- CreateIndex
CREATE INDEX `subscriptions_stripe_customer_id_idx` ON `subscriptions`(`stripe_customer_id`);
