-- CreateTable
CREATE TABLE `modifier_groups` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `min_select` INTEGER NOT NULL DEFAULT 0,
    `max_select` INTEGER NOT NULL DEFAULT 1,
    `allow_quantity` BOOLEAN NOT NULL DEFAULT false,
    `max_quantity_per_modifier` INTEGER NOT NULL DEFAULT 1,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `modifier_groups_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `modifier_options` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `group_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `modifier_options_tenant_id_idx`(`tenant_id`),
    INDEX `modifier_options_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_item_modifier_groups` (
    `id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(191) NOT NULL,
    `modifier_group_id` VARCHAR(191) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `menu_item_modifier_groups_menu_item_id_idx`(`menu_item_id`),
    INDEX `menu_item_modifier_groups_modifier_group_id_idx`(`modifier_group_id`),
    UNIQUE INDEX `menu_item_modifier_groups_menu_item_id_modifier_group_id_key`(`menu_item_id`, `modifier_group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
