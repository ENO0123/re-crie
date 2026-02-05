ALTER TABLE `loans` MODIFY COLUMN `annualInterestRate` decimal(5,3) NOT NULL DEFAULT '0.000';--> statement-breakpoint
ALTER TABLE `billing_data` ADD `isTransfer` boolean DEFAULT false NOT NULL;