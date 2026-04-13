-- AlterTable
ALTER TABLE `orders` ADD COLUMN `fees_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN `fees_breakdown` JSON NULL;
