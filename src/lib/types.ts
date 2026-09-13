// Domain types for the Tarjetero app.

export type Currency = "ARS" | "USD" | "EUR";
export type Brand = "visa" | "mastercard";
export type ThemeName = "violet" | "coral" | "ocean" | "teal" | "rose" | "noir";

export type Rates = Record<Currency, number>;

export type ClosingRuleType = "fixed_day" | "weekday_cycle" | "weekday_from";

export interface Card {
  id: string;
  nickname: string;
  holder: string;
  brand: Brand;
  last4: string;
  limit: number;
  limitCurrency: Currency;
  expiry: string;
  theme: ThemeName;
  issuer?: string | null;
  // billing-cycle closing rule (null = not configured)
  closingRuleType?: ClosingRuleType | null;
  closingDay?: number | null; // fixed_day: the day; weekday_from: "from day"
  closingBusinessAdjust?: boolean;
  closingAnchor?: string | null; // yyyy-mm-dd
  closingNextGap?: number | null; // 28 | 35
  closingWeekday?: number | null; // weekday_from: 0=Sun..6=Sat
  dueDays?: number | null;
  lastPaymentAt?: string | null; // yyyy-mm-dd, day the statement was last paid
  createdAt?: string | null; // yyyy-mm-dd, day the card was added — closings before it are never "pending"
}

export interface Purchase {
  id: string;
  cardId: string;
  merchant: string;
  amount: number;
  currency: Currency;
  installments: number;
  paidInstallments: number;
  category: string;
  date: string; // ISO yyyy-mm-dd
  /** who else this purchase belongs to (shared card / lent card); null = mine */
  sharedWith: string | null;
  /** my share in percent (0..100); always 100 when sharedWith is null */
  myPct: number;
}

export interface Debt {
  id: string;
  creditor: string;
  note: string;
  amount: number;
  currency: Currency;
  installments: number;
  paidInstallments: number;
}

/** A recurring monthly charge. cardId set = charged to that card; null = standalone. */
export interface FixedExpense {
  id: string;
  cardId: string | null;
  name: string;
  amount: number;
  currency: Currency;
  category: string;
  active: boolean;
  /** false = maintenance commission: paid monthly but does not reduce the card limit. */
  occupiesLimit: boolean;
}

/** One line of a saved statement (mirrors a StatementItem). */
export interface StatementSnapshotItem {
  label: string;
  sub: string;
  amount: number; // ARS
  kind: "purchase" | "fixed";
  /** set for purchase lines — what "Deshacer pago" rolls back one installment on */
  purchaseId?: string;
  /** my part of `amount` (ARS); absent on snapshots saved before shared purchases existed (= amount) */
  own?: number;
  sharedWith?: string;
}

/** A card's statement frozen in history the moment it was paid ("Pagar resumen"). */
export interface StatementSnapshot {
  id: string;
  cardId: string;
  period: string; // yyyy-mm-01 — first day of the month the statement closed in
  nickname: string; // card name at payment time (survives if the card is later renamed)
  closingDate: string | null; // yyyy-mm-dd
  dueDate: string | null; // yyyy-mm-dd
  total: number; // ARS
  items: StatementSnapshotItem[];
  paidAt: string | null; // yyyy-mm-dd — day it was paid
}

export interface AppData {
  rates: Rates;
  cards: Card[];
  purchases: Purchase[];
  debts: Debt[];
  fixedExpenses: FixedExpense[];
  snapshots: StatementSnapshot[];
}

export const THEMES: ThemeName[] = [
  "violet",
  "coral",
  "ocean",
  "teal",
  "rose",
  "noir",
];

export const CATEGORIES = [
  "Tecnología",
  "Supermercado",
  "Indumentaria",
  "Viajes",
  "Ocio",
  "Servicios",
  "Salud",
  "Otros",
] as const;

export const CURRENCIES: Currency[] = ["ARS", "USD", "EUR"];
