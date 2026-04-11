-- AlterTable
ALTER TABLE `webhook_events`
  ADD COLUMN `retry_count` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `next_retry_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `webhook_events_status_next_retry_at_idx` ON `webhook_events`(`status`, `next_retry_at`);
