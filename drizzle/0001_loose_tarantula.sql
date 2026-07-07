CREATE TYPE "public"."closing_rule" AS ENUM('fixed_day', 'weekday_cycle');--> statement-breakpoint
CREATE TABLE "fixed_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid,
	"name" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"category" text DEFAULT 'Otros' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "issuer" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "closing_rule_type" "closing_rule";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "closing_day" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "closing_business_adjust" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "closing_anchor" date;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "closing_next_gap" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "due_days" integer;--> statement-breakpoint
ALTER TABLE "fixed_expenses" ADD CONSTRAINT "fixed_expenses_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;