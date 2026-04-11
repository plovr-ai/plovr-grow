-- AlterTable
ALTER TABLE `tax_configs` ADD COLUMN `inclusion_type` VARCHAR(191) NOT NULL DEFAULT 'additive';

-- AlterTable
ALTER TABLE `external_id_mappings` ADD COLUMN `external_version` BIGINT NULL;

-- AlterTable
ALTER TABLE `integration_sync_records` ADD COLUMN `stats` JSON NULL;
