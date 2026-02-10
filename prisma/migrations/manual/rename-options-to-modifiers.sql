-- Rename 'options' column to 'modifiers' in menu_items table
-- This column stores modifier group data for menu items

ALTER TABLE `menu_items` RENAME COLUMN `options` TO `modifiers`;
