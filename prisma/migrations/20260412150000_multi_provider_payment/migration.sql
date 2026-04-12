-- Decouple Payment from Stripe: support multiple payment providers.
-- No real Stripe payment data exists, so this is a non-destructive schema change.

-- 1. Drop the old unique index on stripe_payment_intent_id
DROP INDEX `payments_stripe_payment_intent_id_key` ON `payments`;
DROP INDEX `payments_stripe_payment_intent_id_idx` ON `payments`;

-- 2. Add new provider columns
ALTER TABLE `payments` ADD COLUMN `provider` VARCHAR(191) NOT NULL DEFAULT 'stripe';
ALTER TABLE `payments` ADD COLUMN `provider_payment_id` VARCHAR(191) NULL;

-- 3. Migrate existing data: copy stripe_payment_intent_id to provider_payment_id
UPDATE `payments` SET `provider_payment_id` = `stripe_payment_intent_id` WHERE `stripe_payment_intent_id` IS NOT NULL;

-- 4. Remove default from provider (was only for migration)
ALTER TABLE `payments` ALTER COLUMN `provider` DROP DEFAULT;

-- 5. Drop old Stripe-specific columns
ALTER TABLE `payments` DROP COLUMN `stripe_payment_intent_id`;
ALTER TABLE `payments` DROP COLUMN `stripe_customer_id`;
ALTER TABLE `payments` DROP COLUMN `stripe_account_id`;

-- 6. Add composite unique index on (provider, provider_payment_id)
CREATE UNIQUE INDEX `payments_provider_provider_payment_id_key` ON `payments`(`provider`, `provider_payment_id`);

-- 7. Create stripe_payment_details table for Stripe-specific fields
CREATE TABLE `stripe_payment_details` (
    `id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `stripe_account_id` VARCHAR(191) NOT NULL,
    `stripe_customer_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stripe_payment_details_payment_id_key`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
