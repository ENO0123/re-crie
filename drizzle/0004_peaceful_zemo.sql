CREATE TABLE `month_statuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`organizationId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`status` enum('actual','forecast','prediction') NOT NULL DEFAULT 'actual',
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `month_statuses_id` PRIMARY KEY(`id`)
);
