/*
  Warnings:

  - A unique constraint covering the columns `[stytch_user_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `stytch_user_id` VARCHAR(191) NULL,
    MODIFY `password_hash` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_stytch_user_id_key` ON `users`(`stytch_user_id`);
