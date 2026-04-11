-- Rename residual Company-era schema to Tenant/GiftCard naming (issue #93).
-- Written as RENAME/ALTER so existing rows (daily gift-card sequences,
-- previously completed website generations) are preserved.

-- 1. gift card order sequences: drop leftover company_id column + stale
--    unique/index, then rename the table and its remaining indexes.

ALTER TABLE `company_order_sequences`
  DROP INDEX `company_order_sequences_tenant_id_company_id_date_key`,
  DROP INDEX `company_order_sequences_company_id_idx`,
  DROP COLUMN `company_id`;

RENAME TABLE `company_order_sequences` TO `gift_card_order_sequences`;

ALTER TABLE `gift_card_order_sequences`
  RENAME INDEX `company_order_sequences_tenant_id_idx` TO `gift_card_order_sequences_tenant_id_idx`,
  RENAME INDEX `company_order_sequences_date_idx` TO `gift_card_order_sequences_date_idx`;

CREATE UNIQUE INDEX `gift_card_order_sequences_tenant_id_date_key`
  ON `gift_card_order_sequences`(`tenant_id`, `date`);

-- 2. website_generations.company_slug → tenant_slug (preserves existing rows
--    so the "already generated" short-circuit keeps working for old records).

ALTER TABLE `website_generations` RENAME COLUMN `company_slug` TO `tenant_slug`;
