// Domain types for the Tarjetero app.

export type Currency = "ARS" | "USD" | "EUR";
export type Brand = "visa" | "mastercard";
export type ThemeName = "violet" | "coral" | "ocean" | "teal" | "rose" | "noir";

export type Rates = Record<Currency, number>;

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

export interface AppData {
  rates: Rates;
  cards: Card[];
  purchases: Purchase[];
  debts: Debt[];
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
