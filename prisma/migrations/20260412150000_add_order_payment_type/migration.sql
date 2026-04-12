-- AlterTable: add payment_type to orders
ALTER TABLE `orders` ADD COLUMN `payment_type` VARCHAR(191) NOT NULL DEFAULT 'online';
