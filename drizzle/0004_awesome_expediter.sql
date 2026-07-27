CREATE TABLE "statement_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"period" date NOT NULL,
	"nickname" text NOT NULL,
	"closing_date" date,
	"due_date" date,
	"total" numeric(14, 2) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "statement_snapshots" ADD CONSTRAINT "statement_snapshots_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "statement_snapshots_user_card_period_uq" ON "statement_snapshots" USING btree ("user_id","card_id","period");