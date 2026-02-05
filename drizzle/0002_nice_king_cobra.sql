CREATE TABLE `loan_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loanId` int NOT NULL,
	`organizationId` int NOT NULL,
	`action` enum('create','update','activate','deactivate') NOT NULL,
	`effectiveFrom` date NOT NULL,
	`previousValues` text,
	`newValues` text,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loan_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`financialInstitution` varchar(255) NOT NULL,
	`branchName` varchar(255),
	`repaymentMethod` enum('equal_principal','equal_installment') NOT NULL,
	`annualInterestRate` decimal(5,2) NOT NULL DEFAULT '0.00',
	`initialBorrowingDate` date NOT NULL,
	`repaymentDueDate` int NOT NULL,
	`initialBorrowingAmount` int NOT NULL DEFAULT 0,
	`repaymentPrincipal` int NOT NULL DEFAULT 0,
	`firstRepaymentDate` date NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`effectiveFrom` date NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`)
);
