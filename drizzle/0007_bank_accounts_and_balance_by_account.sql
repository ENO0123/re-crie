-- 金融機関マスタ追加、口座残高を金融機関ごとに変更
-- 1. 金融機関テーブル作成（MySQL互換: CURRENT_TIMESTAMP を使用）
CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `displayOrder` int DEFAULT 0 NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);

-- 2. 既存の口座残高テーブルを退避
RENAME TABLE `bank_balances` TO `bank_balances_old`;

-- 3. 新口座残高テーブル作成（金融機関ごと・月ごと）
CREATE TABLE `bank_balances` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int NOT NULL,
  `yearMonth` varchar(7) NOT NULL,
  `bankAccountId` int NOT NULL,
  `balance` int DEFAULT 0 NOT NULL,
  `createdBy` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `bank_balances_id` PRIMARY KEY(`id`)
);
