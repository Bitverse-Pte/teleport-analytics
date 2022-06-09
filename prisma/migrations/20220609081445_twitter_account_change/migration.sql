/*
  Warnings:

  - You are about to drop the column `Replies` on the `TweetRealTimeStat` table. All the data in the column will be lost.
  - You are about to drop the column `tweetID` on the `TweetRealTimeStat` table. All the data in the column will be lost.
  - Added the required column `replies` to the `TweetRealTimeStat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tweetId` to the `TweetRealTimeStat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accessToken` to the `TwitterAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `expiresAt` to the `TwitterAccount` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refreshToken` to the `TwitterAccount` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TweetRealTimeStat` DROP COLUMN `Replies`,
    DROP COLUMN `tweetID`,
    ADD COLUMN `replies` INTEGER NOT NULL,
    ADD COLUMN `tweetId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `TwitterAccount` ADD COLUMN `accessToken` VARCHAR(191) NOT NULL,
    ADD COLUMN `expiresAt` DATETIME(3) NOT NULL,
    ADD COLUMN `refreshToken` VARCHAR(191) NOT NULL;
