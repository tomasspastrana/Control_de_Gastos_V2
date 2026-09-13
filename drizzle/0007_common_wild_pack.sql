ALTER TABLE "purchases" ADD COLUMN "shared_with" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "my_pct" integer DEFAULT 100 NOT NULL;