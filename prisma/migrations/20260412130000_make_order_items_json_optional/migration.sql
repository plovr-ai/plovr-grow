-- AlterTable: make Order.items nullable (deprecated in favour of OrderItem relation)
ALTER TABLE `orders` MODIFY COLUMN `items` JSON NULL;
