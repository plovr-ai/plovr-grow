-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `total_price` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `image_url` VARCHAR(191) NULL,
    `taxes` JSON NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_menu_item_id_idx`(`menu_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_item_modifiers` (
    `id` VARCHAR(191) NOT NULL,
    `order_item_id` VARCHAR(191) NOT NULL,
    `modifier_group_id` VARCHAR(191) NOT NULL,
    `modifier_option_id` VARCHAR(191) NOT NULL,
    `group_name` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `order_item_modifiers_order_item_id_idx`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
