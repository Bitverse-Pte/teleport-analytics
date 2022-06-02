-- CreateTable
CREATE TABLE `TelegramChatMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` DECIMAL(65, 0) NOT NULL,
    `groupId` DECIMAL(65, 0) NOT NULL,
    `joinAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `messageCount` INTEGER NOT NULL DEFAULT 0,
    `lastSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activeDays` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TelegramGroupDailyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` DECIMAL(65, 0) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `newMemberCount` INTEGER NOT NULL,
    `messageCount` INTEGER NOT NULL,
    `activeMemberCount` INTEGER NOT NULL,
    `totalMemberCount` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
