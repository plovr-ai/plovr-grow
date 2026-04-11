-- Rename residual Company-era schema to Tenant/GiftCard naming (issue #93).
-- Uses RENAME TABLE + DROP/CREATE INDEX (with IF EXISTS / IF NOT EXISTS)
-- so existing rows are preserved and the migration is idempotent across
-- any intermediate DB states left behind by #82.
--
-- The deployed DB already reflects the post-#82 state (no company_id
-- column, unique key is [tenant_id, date]), but the init migration SQL
-- was never regenerated to match. IF EXISTS guards make this safe to
-- re-apply regardless of which Company-era objects actually exist.

-- 1. Clean any leftover Company-era objects on the old table.

ALTER TABLE `company_order_sequences`
  DROP INDEX IF EXISTS `company_order_sequences_tenant_id_company_id_date_key`;
ALTER TABLE `company_order_sequences`
  DROP INDEX IF EXISTS `company_order_sequences_company_id_idx`;
ALTER TABLE `company_order_sequences`
  DROP COLUMN IF EXISTS `company_id`;

-- 2. Rename the table (preserves all rows).

RENAME TABLE `company_order_sequences` TO `gift_card_order_sequences`;

-- 3. Drop-and-recreate the remaining indexes under the new table prefix.
--    Using DROP IF EXISTS + CREATE IF NOT EXISTS keeps this idempotent
--    regardless of which old name the index currently carries.
--    The table is tiny (one row per tenant per day), so rebuilding
--    indexes is cheap.

ALTER TABLE `gift_card_order_sequences`
  DROP INDEX IF EXISTS `company_order_sequences_tenant_id_idx`;
ALTER TABLE `gift_card_order_sequences`
  DROP INDEX IF EXISTS `company_order_sequences_date_idx`;
ALTER TABLE `gift_card_order_sequences`
  DROP INDEX IF EXISTS `company_order_sequences_tenant_id_date_key`;

CREATE INDEX IF NOT EXISTS `gift_card_order_sequences_tenant_id_idx`
  ON `gift_card_order_sequences`(`tenant_id`);
CREATE INDEX IF NOT EXISTS `gift_card_order_sequences_date_idx`
  ON `gift_card_order_sequences`(`date`);
CREATE UNIQUE INDEX IF NOT EXISTS `gift_card_order_sequences_tenant_id_date_key`
  ON `gift_card_order_sequences`(`tenant_id`, `date`);

-- 4. website_generations.company_slug → tenant_slug (preserves existing
--    rows so the "already generated" short-circuit keeps working for
--    old records).

ALTER TABLE `website_generations` RENAME COLUMN `company_slug` TO `tenant_slug`;
