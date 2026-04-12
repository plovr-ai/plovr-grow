-- Backfill fulfillment_status_logs from OrderFulfillment timestamps so that
-- buildTimeline() can reconstruct the fulfillment history for migrated orders.
-- Each non-null timestamp becomes a status log entry with source='migration'.

-- confirmed
INSERT INTO `fulfillment_status_logs` (`id`, `fulfillment_id`, `tenant_id`, `from_status`, `to_status`, `source`, `created_at`)
SELECT CONCAT('fsl_', REPLACE(UUID(), '-', '')), f.`id`, f.`tenant_id`, 'pending', 'confirmed', 'migration', f.`confirmed_at`
FROM `order_fulfillments` f WHERE f.`confirmed_at` IS NOT NULL;

-- preparing
INSERT INTO `fulfillment_status_logs` (`id`, `fulfillment_id`, `tenant_id`, `from_status`, `to_status`, `source`, `created_at`)
SELECT CONCAT('fsl_', REPLACE(UUID(), '-', '')), f.`id`, f.`tenant_id`, 'confirmed', 'preparing', 'migration', f.`preparing_at`
FROM `order_fulfillments` f WHERE f.`preparing_at` IS NOT NULL;

-- ready
INSERT INTO `fulfillment_status_logs` (`id`, `fulfillment_id`, `tenant_id`, `from_status`, `to_status`, `source`, `created_at`)
SELECT CONCAT('fsl_', REPLACE(UUID(), '-', '')), f.`id`, f.`tenant_id`, 'preparing', 'ready', 'migration', f.`ready_at`
FROM `order_fulfillments` f WHERE f.`ready_at` IS NOT NULL;

-- fulfilled
INSERT INTO `fulfillment_status_logs` (`id`, `fulfillment_id`, `tenant_id`, `from_status`, `to_status`, `source`, `created_at`)
SELECT CONCAT('fsl_', REPLACE(UUID(), '-', '')), f.`id`, f.`tenant_id`, 'ready', 'fulfilled', 'migration', f.`fulfilled_at`
FROM `order_fulfillments` f WHERE f.`fulfilled_at` IS NOT NULL;

-- canceled
INSERT INTO `fulfillment_status_logs` (`id`, `fulfillment_id`, `tenant_id`, `from_status`, `to_status`, `source`, `created_at`)
SELECT CONCAT('fsl_', REPLACE(UUID(), '-', '')), f.`id`, f.`tenant_id`, f.`status`, 'canceled', 'migration', f.`cancelled_at`
FROM `order_fulfillments` f WHERE f.`cancelled_at` IS NOT NULL AND f.`status` = 'canceled';
