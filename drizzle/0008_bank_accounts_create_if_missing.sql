-- bank_accounts が 0007 で作成されなかった場合の回復用（IF NOT EXISTS のため既存環境でも安全）
CREATE TABLE IF NOT EXISTS `bank_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `organizationId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `displayOrder` int DEFAULT 0 NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
