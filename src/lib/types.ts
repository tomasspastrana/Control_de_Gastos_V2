// Domain types for the Tarjetero app.

export type Currency = "ARS" | "USD" | "EUR";
export type Brand = "visa" | "mastercard";
export type ThemeName = "violet" | "coral" | "ocean" | "teal" | "rose" | "noir";

export type Rates = Record<Currency, number>;

export type ClosingRuleType = "fixed_day" | "weekday_cycle";

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
  closingDay?: number | null;
  closingBusinessAdjust?: boolean;
  closingAnchor?: string | null; // yyyy-mm-dd
  closingNextGap?: number | null; // 28 | 35
  dueDays?: number | null;
  lastPaymentAt?: string | null; // yyyy-mm-dd, day the statement was last paid
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

/** One line of a saved statement (mirrors a StatementItem, without the runtime purchaseId). */
export interface StatementSnapshotItem {
  label: string;
  sub: string;
  amount: number; // ARS
  kind: "purchase" | "fixed";
}

/** A card's statement frozen in history when a month is closed ("Cerrar mes"). */
export interface StatementSnapshot {
  id: string;
  cardId: string;
  period: string; // yyyy-mm-01 — first day of the closed month
  nickname: string; // card name at close time (survives if the card is later renamed)
  closingDate: string | null; // yyyy-mm-dd
  dueDate: string | null; // yyyy-mm-dd
  total: number; // ARS
  items: StatementSnapshotItem[];
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
