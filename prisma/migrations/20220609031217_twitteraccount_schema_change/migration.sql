/*
  Warnings:

  - Added the required column `followingCount` to the `TwitterAccountRealTimeStat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `listedCount` to the `TwitterAccountRealTimeStat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tweetCount` to the `TwitterAccountRealTimeStat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TwitterAccountRealTimeStat` ADD COLUMN `followingCount` INTEGER NOT NULL,
    ADD COLUMN `listedCount` INTEGER NOT NULL,
    ADD COLUMN `tweetCount` INTEGER NOT NULL,
    MODIFY `twitterAccountId` VARCHAR(191) NOT NULL;
