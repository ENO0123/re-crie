CREATE TABLE `bank_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`balance1` int NOT NULL DEFAULT 0,
	`balance2` int NOT NULL DEFAULT 0,
	`balance3` int NOT NULL DEFAULT 0,
	`balance4` int NOT NULL DEFAULT 0,
	`balance5` int NOT NULL DEFAULT 0,
	`totalBalance` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bank_balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`billingYearMonth` varchar(6) NOT NULL,
	`serviceYearMonth` varchar(6) NOT NULL,
	`userName` varchar(255) NOT NULL,
	`totalCost` int NOT NULL DEFAULT 0,
	`insurancePayment` int NOT NULL DEFAULT 0,
	`publicPayment` int NOT NULL DEFAULT 0,
	`reduction` int NOT NULL DEFAULT 0,
	`userBurdenTransfer` int NOT NULL DEFAULT 0,
	`userBurdenWithdrawal` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`category` varchar(50) NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`amount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expense_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`personnelCost` int NOT NULL DEFAULT 0,
	`legalWelfare` int NOT NULL DEFAULT 0,
	`advertising` int NOT NULL DEFAULT 0,
	`travelVehicle` int NOT NULL DEFAULT 0,
	`communication` int NOT NULL DEFAULT 0,
	`consumables` int NOT NULL DEFAULT 0,
	`utilities` int NOT NULL DEFAULT 0,
	`rent` int NOT NULL DEFAULT 0,
	`leaseLoan` int NOT NULL DEFAULT 0,
	`paymentFee` int NOT NULL DEFAULT 0,
	`paymentCommission` int NOT NULL DEFAULT 0,
	`paymentInterest` int NOT NULL DEFAULT 0,
	`miscellaneous` int NOT NULL DEFAULT 0,
	`pettyCash` int NOT NULL DEFAULT 0,
	`cardPayment` int NOT NULL DEFAULT 0,
	`representativeLoanRepayment` int NOT NULL DEFAULT 0,
	`shortTermLoanRepayment` int NOT NULL DEFAULT 0,
	`longTermLoanRepayment` int NOT NULL DEFAULT 0,
	`regularDeposit` int NOT NULL DEFAULT 0,
	`taxPayment` int NOT NULL DEFAULT 0,
	`otherNonBusinessExpense` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expense_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `factoring_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`factoringRate` int NOT NULL DEFAULT 8000,
	`remainingRate` int NOT NULL DEFAULT 2000,
	`feeRate` int NOT NULL DEFAULT 70,
	`usageFee` int NOT NULL DEFAULT 2000,
	`paymentDay` int NOT NULL DEFAULT 15,
	`remainingPaymentDay` int NOT NULL DEFAULT 5,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `factoring_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `income_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`insuranceIncome` int NOT NULL DEFAULT 0,
	`userBurdenTransfer` int NOT NULL DEFAULT 0,
	`userBurdenWithdrawal` int NOT NULL DEFAULT 0,
	`factoringIncome1` int NOT NULL DEFAULT 0,
	`factoringIncome2` int NOT NULL DEFAULT 0,
	`otherBusinessIncome` int NOT NULL DEFAULT 0,
	`representativeLoan` int NOT NULL DEFAULT 0,
	`shortTermLoan` int NOT NULL DEFAULT 0,
	`longTermLoan` int NOT NULL DEFAULT 0,
	`interestIncome` int NOT NULL DEFAULT 0,
	`otherNonBusinessIncome` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `income_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `users` ADD `organizationId` int;