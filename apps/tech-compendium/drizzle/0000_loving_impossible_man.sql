CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`tech_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `classes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '✦' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT '#7770ff' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classes_slug_unique` ON `classes` (`slug`);--> statement-breakpoint
CREATE TABLE `techs` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
