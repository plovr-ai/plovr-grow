/*
  Warnings:

  - A unique constraint covering the columns `[ai_phone]` on the table `merchants` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `merchants` ADD COLUMN `ai_phone` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `merchants_ai_phone_key` ON `merchants`(`ai_phone`);
