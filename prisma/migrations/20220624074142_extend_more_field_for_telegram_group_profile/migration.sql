-- AlterTable
ALTER TABLE `TelegramGroup` ADD COLUMN `bio` VARCHAR(191) NULL,
    ADD COLUMN `invite_link` VARCHAR(191) NULL,
    ADD COLUMN `message_auto_delete_time` INTEGER NULL,
    ADD COLUMN `photo` VARCHAR(191) NULL,
    ADD COLUMN `slow_mode_delay` INTEGER NULL,
    ADD COLUMN `title` VARCHAR(191) NULL,
    ADD COLUMN `type` VARCHAR(191) NULL,
    ADD COLUMN `username` VARCHAR(191) NULL;
