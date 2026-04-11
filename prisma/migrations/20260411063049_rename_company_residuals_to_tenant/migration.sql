/*
  Warnings:

  - You are about to drop the column `company_slug` on the `website_generations` table. All the data in the column will be lost.
  - You are about to drop the `company_order_sequences` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `website_generations` DROP COLUMN `company_slug`,
    ADD COLUMN `tenant_slug` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `company_order_sequences`;

-- CreateTable
CREATE TABLE `gift_card_order_sequences` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `gift_card_order_sequences_tenant_id_idx`(`tenant_id`),
    INDEX `gift_card_order_sequences_date_idx`(`date`),
    UNIQUE INDEX `gift_card_order_sequences_tenant_id_date_key`(`tenant_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
