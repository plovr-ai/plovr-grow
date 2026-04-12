-- CreateTable: order_fulfillments
CREATE TABLE `order_fulfillments` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `merchant_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `pos_provider` VARCHAR(191) NULL,
    `external_version` INTEGER NULL,
    `confirmed_at` DATETIME(3) NULL,
    `preparing_at` DATETIME(3) NULL,
    `ready_at` DATETIME(3) NULL,
    `fulfilled_at` DATETIME(3) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancel_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_fulfillments_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `order_fulfillments_order_id_idx`(`order_id`),
    INDEX `order_fulfillments_merchant_id_status_idx`(`merchant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: fulfillment_status_logs
CREATE TABLE `fulfillment_status_logs` (
    `id` VARCHAR(191) NOT NULL,
    `fulfillment_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `from_status` VARCHAR(191) NOT NULL,
    `to_status` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fulfillment_status_logs_fulfillment_id_created_at_idx`(`fulfillment_id`, `created_at`),
    INDEX `fulfillment_status_logs_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing order fulfillment data to new tables.
-- For each order with a merchant, create an OrderFulfillment record
-- copying the fulfillment-related fields.
INSERT INTO `order_fulfillments` (
    `id`, `order_id`, `tenant_id`, `merchant_id`, `status`,
    `pos_provider`, `external_version`,
    `confirmed_at`, `preparing_at`, `ready_at`, `fulfilled_at`,
    `cancelled_at`, `cancel_reason`,
    `created_at`, `updated_at`
)
SELECT
    CONCAT('ful_', REPLACE(UUID(), '-', '')),
    o.`id`,
    o.`tenant_id`,
    o.`merchant_id`,
    o.`fulfillment_status`,
    NULL,
    o.`square_order_version`,
    o.`confirmed_at`,
    o.`preparing_at`,
    o.`ready_at`,
    o.`fulfilled_at`,
    CASE WHEN o.`fulfillment_status` = 'canceled' THEN o.`cancelled_at` ELSE NULL END,
    CASE WHEN o.`fulfillment_status` = 'canceled' THEN o.`cancel_reason` ELSE NULL END,
    o.`created_at`,
    o.`updated_at`
FROM `orders` o
WHERE o.`merchant_id` IS NOT NULL
  AND o.`deleted` = 0;

-- Drop migrated columns from orders table
ALTER TABLE `orders` DROP COLUMN `confirmed_at`,
    DROP COLUMN `preparing_at`,
    DROP COLUMN `ready_at`,
    DROP COLUMN `fulfilled_at`,
    DROP COLUMN `square_order_version`;
