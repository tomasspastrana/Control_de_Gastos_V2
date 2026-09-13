ALTER TYPE "public"."closing_rule" ADD VALUE 'weekday_from';--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "closing_weekday" integer;