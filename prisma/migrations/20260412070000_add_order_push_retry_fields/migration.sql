-- AlterTable
ALTER TABLE `integration_sync_records` ADD COLUMN `payload` JSON NULL,
    ADD COLUMN `retry_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `next_retry_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `integration_sync_records_sync_type_status_next_retry_at_idx` ON `integration_sync_records`(`sync_type`, `status`, `next_retry_at`);
