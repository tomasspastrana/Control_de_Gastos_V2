// Drizzle schema — source of truth for the Postgres tables.
// user_id references Supabase's auth.users(id); that FK + RLS live in supabase/rls.sql
// (Drizzle does not manage the `auth` schema).

import { boolean, integer, numeric, pgEnum, pgTable, text, timestamp, uuid, date } from "drizzle-orm/pg-core";

export const currencyEnum = pgEnum("currency", ["ARS", "USD", "EUR"]);
export const brandEnum = pgEnum("card_brand", ["visa", "mastercard"]);
export const themeEnum = pgEnum("card_theme", ["violet", "coral", "ocean", "teal", "rose", "noir"]);
export const closingRuleEnum = pgEnum("closing_rule", ["fixed_day", "weekday_cycle"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name").notNull().default(""),
  rateUsd: numeric("rate_usd", { precision: 14, scale: 4, mode: "number" }).notNull().default(1015),
  rateEur: numeric("rate_eur", { precision: 14, scale: 4, mode: "number" }).notNull().default(1120),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  nickname: text("nickname").notNull(),
  holder: text("holder").notNull().default(""),
  brand: brandEnum("brand").notNull().default("visa"),
  last4: text("last4").notNull().default("0000"),
  limitAmount: numeric("limit_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  limitCurrency: currencyEnum("limit_currency").notNull().default("ARS"),
  expiry: text("expiry").notNull().default("--/--"),
  theme: themeEnum("theme").notNull().default("violet"),
  issuer: text("issuer"),
  // billing-cycle closing rule (nullable = not configured)
  closingRuleType: closingRuleEnum("closing_rule_type"),
  closingDay: integer("closing_day"),
  closingBusinessAdjust: boolean("closing_business_adjust").notNull().default(false),
  closingAnchor: date("closing_anchor", { mode: "string" }),
  closingNextGap: integer("closing_next_gap"),
  dueDays: integer("due_days"),
  // day the card statement was last paid ("Pagar tarjeta"); clears the payment-due alert
  lastPaymentAt: date("last_payment_at", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  cardId: uuid("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  merchant: text("merchant").notNull().default("Compra"),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  installments: integer("installments").notNull().default(1),
  paidInstallments: integer("paid_installments").notNull().default(0),
  category: text("category").notNull().default("Otros"),
  date: date("date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const debts = pgTable("debts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  creditor: text("creditor").notNull(),
  note: text("note").notNull().default(""),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  installments: integer("installments").notNull().default(1),
  paidInstallments: integer("paid_installments").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Recurring monthly charges (subscriptions, obra social, hosting, …).
// cardId nullable: set = charged to that card (occupies its limit); null = standalone.
export const fixedExpenses = pgTable("fixed_expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  cardId: uuid("card_id").references(() => cards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  currency: currencyEnum("currency").notNull().default("ARS"),
  category: text("category").notNull().default("Otros"),
  active: boolean("active").notNull().default(true),
  // false = maintenance commission: billed/paid but does NOT reduce the card's limit
  occupiesLimit: boolean("occupies_limit").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileRow = typeof profiles.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
export type PurchaseRow = typeof purchases.$inferSelect;
export type DebtRow = typeof debts.$inferSelect;
export type FixedExpenseRow = typeof fixedExpenses.$inferSelect;
