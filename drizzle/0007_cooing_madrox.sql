CREATE TABLE `bank_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bank_balances` ADD `bankAccountId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_balances` ADD `balance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_balances` DROP COLUMN `balance1`;--> statement-breakpoint
ALTER TABLE `bank_balances` DROP COLUMN `balance2`;--> statement-breakpoint
ALTER TABLE `bank_balances` DROP COLUMN `balance3`;--> statement-breakpoint
ALTER TABLE `bank_balances` DROP COLUMN `balance4`;--> statement-breakpoint
ALTER TABLE `bank_balances` DROP COLUMN `balance5`;--> statement-breakpoint
ALTER TABLE `bank_balances` DROP COLUMN `totalBalance`;