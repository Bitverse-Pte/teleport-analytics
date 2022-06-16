-- CreateTable
CREATE TABLE `TelegramGroupStats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` DECIMAL(65, 0) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `newMemberCount` INTEGER NOT NULL,
    `messageCount` INTEGER NOT NULL,
    `totalMemberCount` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
