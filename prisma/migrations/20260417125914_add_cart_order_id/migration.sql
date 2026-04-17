-- AlterTable
ALTER TABLE `carts` ADD COLUMN `order_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `carts_order_id_idx` ON `carts`(`order_id`);
