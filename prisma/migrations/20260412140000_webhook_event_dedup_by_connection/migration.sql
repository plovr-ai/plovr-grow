-- Change webhook event dedup scope from global eventId to per-connection.
-- This prevents cross-provider eventId collisions when multiple POS
-- providers write to the same webhook_events table.

-- Drop the old global unique constraint
DROP INDEX `webhook_events_event_id_key` ON `webhook_events`;

-- Add composite unique constraint scoped by connection
CREATE UNIQUE INDEX `webhook_events_connection_id_event_id_key` ON `webhook_events`(`connection_id`, `event_id`);
