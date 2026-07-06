CREATE TYPE "public"."card_brand" AS ENUM('visa', 'mastercard');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('ARS', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."card_theme" AS ENUM('violet', 'coral', 'ocean', 'teal', 'rose', 'noir');--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"holder" text DEFAULT '' NOT NULL,
	"brand" "card_brand" DEFAULT 'visa' NOT NULL,
	"last4" text DEFAULT '0000' NOT NULL,
	"limit_amount" numeric(14, 2) NOT NULL,
	"limit_currency" "currency" DEFAULT 'ARS' NOT NULL,
	"expiry" text DEFAULT '--/--' NOT NULL,
	"theme" "card_theme" DEFAULT 'violet' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"creditor" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"paid_installments" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"rate_usd" numeric(14, 4) DEFAULT 1015 NOT NULL,
	"rate_eur" numeric(14, 4) DEFAULT 1120 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"merchant" text DEFAULT 'Compra' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"installments" integer DEFAULT 1 NOT NULL,
	"paid_installments" integer DEFAULT 0 NOT NULL,
	"category" text DEFAULT 'Otros' NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;