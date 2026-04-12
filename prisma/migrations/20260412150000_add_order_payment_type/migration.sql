-- AlterTable: add payment_type to orders
ALTER TABLE `orders` ADD COLUMN `payment_type` VARCHAR(20) NOT NULL DEFAULT 'online' AFTER `sales_channel`;
