// Business logic ported 1:1 from the prototype (reference/prototype.html).
// Pure functions only — easy to unit-test and reuse on client & server.

import type { Card, Currency, Debt, FixedExpense, Purchase, Rates, ThemeName } from "./types";

// ---------- currency & formatting ----------
export function rate(rates: Rates, c: Currency): number {
  return rates[c] || 1;
}

export function fmt(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

export function fmtShort(n: number): string {
  n = Math.round(n || 0);
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return "$" + Math.round(n / 1000) + "k";
  return "$" + n;
}

export function curSym(c: Currency): string {
  return { ARS: "$", USD: "US$", EUR: "€" }[c] || "";
}

export function fmtCur(a: number, c: Currency): string {
  return (
    curSym(c) +
    " " +
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
      Math.round(a || 0),
    )
  );
}

export function fmtDate(d: string): string {
  try {
    return new Date(d + "T00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return d;
  }
}

// ---------- colors ----------
export function themeColors(t: ThemeName): [string, string] {
  const map: Record<ThemeName, [string, string]> = {
    violet: ["#7C6BF7", "#A99CFB"],
    coral: ["#F0996A", "#F6C4A0"],
    ocean: ["#5B7CF7", "#8FB4FB"],
    teal: ["#2FB79A", "#7FD9C4"],
    rose: ["#EC6A8C", "#F4A7BC"],
    noir: ["#3A3A48", "#565672"],
  };
  return map[t] || ["#7C6BF7", "#A99CFB"];
}

export function catColor(c: string): string {
  const map: Record<string, string> = {
    Tecnología: "#7C6BF7",
    Supermercado: "#F0996A",
    Indumentaria: "#5B9CF0",
    Viajes: "#2FB79A",
    Ocio: "#C879D8",
    Servicios: "#E8B94E",
    Salud: "#EC6A8C",
    Otros: "#9AA0B4",
  };
  return map[c] || "#9AA0B4";
}

export function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------- metrics ----------
/** What someone else owes me on a card: their remaining share of the purchases they're on. */
export interface OtherShare {
  name: string;
  amount: number;
}

export interface CardMetrics {
  /** full card debt — what occupies the limit and what the bank bills, whoever's it is */
  debt: number;
  /** my part of `debt` (shared purchases count only my share; fixed expenses are always mine) */
  ownDebt: number;
  /** debt − ownDebt broken down by person, largest first */
  others: OtherShare[];
  limit: number;
  avail: number;
  pct: number;
  count: number;
  monthly: number;
}

/** Amount (in ARS) of a single installment of a purchase. */
export function purchaseInstallment(p: Purchase, rates: Rates): number {
  const tot = p.amount * rate(rates, p.currency);
  return tot / (p.installments || 1);
}

/** Remaining debt (in ARS) of a single purchase given its installment progress. */
export function purchaseRemaining(p: Purchase, rates: Rates): number {
  const tot = p.amount * rate(rates, p.currency);
  return (tot * (p.installments - p.paidInstallments)) / (p.installments || 1);
}

/** My share of a purchase, 0..1 (a purchase with nobody else on it is fully mine). */
export function ownFraction(p: Pick<Purchase, "sharedWith" | "myPct">): number {
  if (!p.sharedWith) return 1;
  return Math.min(100, Math.max(0, p.myPct ?? 100)) / 100;
}

/** My part (ARS) of one installment. */
export function purchaseOwnInstallment(p: Purchase, rates: Rates): number {
  return purchaseInstallment(p, rates) * ownFraction(p);
}

/** My part (ARS) of what's still owed on a purchase. */
export function purchaseOwnRemaining(p: Purchase, rates: Rates): number {
  return purchaseRemaining(p, rates) * ownFraction(p);
}

/** Merge per-person amounts (name → ARS) into a list sorted largest first, dropping zeros. */
export function othersList(map: Record<string, number>): OtherShare[] {
  return Object.keys(map)
    .filter((k) => map[k] > 0.005)
    .map((name) => ({ name, amount: map[name] }))
    .sort((a, b) => b.amount - a.amount);
}

/** Total ARS/month of the active fixed expenses in a list. */
export function fixedMonthly(fixed: FixedExpense[], rates: Rates): number {
  return fixed.reduce(
    (s, f) => (f.active ? s + f.amount * rate(rates, f.currency) : s),
    0,
  );
}

/** Sum (ARS) of one installment per debt that still owes — this month's debt bill. */
export function debtsMonthly(debts: Debt[], rates: Rates): number {
  return debts.reduce((s, d) => {
    if (d.paidInstallments >= d.installments) return s;
    return s + (d.amount * rate(rates, d.currency)) / (d.installments || 1);
  }, 0);
}

/** Aggregate metrics for one card, in ARS. */
export function cardMetrics(
  card: Card,
  purchases: Purchase[],
  rates: Rates,
  fixed: FixedExpense[] = [],
): CardMetrics {
  const ps = purchases.filter((p) => p.cardId === card.id);
  let debt = 0;
  let ownDebt = 0;
  let monthly = 0;
  const othersMap: Record<string, number> = {};
  ps.forEach((p) => {
    const rem = purchaseRemaining(p, rates);
    const own = purchaseOwnRemaining(p, rates);
    debt += rem;
    ownDebt += own;
    if (p.sharedWith) othersMap[p.sharedWith] = (othersMap[p.sharedWith] || 0) + (rem - own);
    // this month's bill: one installment per purchase that still owes
    if (p.paidInstallments < p.installments) {
      monthly += purchaseInstallment(p, rates);
    }
  });
  // active fixed expenses charged to this card. Those that occupy limit add to
  // debt AND to this month's bill; maintenance commissions (occupiesLimit=false)
  // are paid monthly but do NOT reduce the limit, so they add to monthly only.
  // Fixed expenses are always mine, so they add to ownDebt in full.
  const cardFixed = fixed.filter((f) => f.cardId === card.id);
  const fxOccupy = fixedMonthly(cardFixed.filter((f) => f.occupiesLimit), rates);
  const fxNonOccupy = fixedMonthly(cardFixed.filter((f) => !f.occupiesLimit), rates);
  debt += fxOccupy;
  ownDebt += fxOccupy;
  monthly += fxOccupy + fxNonOccupy;
  const limit = card.limit * rate(rates, card.limitCurrency || "ARS");
  const avail = limit - debt;
  const pct = limit > 0 ? Math.min(1, debt / limit) : 0;
  return { debt, ownDebt, others: othersList(othersMap), limit, avail, pct, count: ps.length, monthly };
}

export interface Totals {
  debt: number;
  ownDebt: number;
  others: OtherShare[];
  limit: number;
  avail: number;
  monthly: number; // sum of every card's current statement ("cuota de este mes")
}

export function totals(
  cards: Card[],
  purchases: Purchase[],
  rates: Rates,
  fixed: FixedExpense[] = [],
): Totals {
  let debt = 0,
    ownDebt = 0,
    limit = 0,
    avail = 0,
    monthly = 0;
  const othersMap: Record<string, number> = {};
  cards.forEach((c) => {
    const m = cardMetrics(c, purchases, rates, fixed);
    debt += m.debt;
    ownDebt += m.ownDebt;
    limit += m.limit;
    avail += m.avail;
    monthly += m.monthly;
    m.others.forEach((o) => (othersMap[o.name] = (othersMap[o.name] || 0) + o.amount));
  });
  return { debt, ownDebt, others: othersList(othersMap), limit, avail, monthly };
}

// ---------- category breakdown ----------
export interface CategoryEntry {
  name: string;
  amount: number;
  color: string;
  pct: number; // 0..1 of total spend
}

export interface CategoryBreakdown {
  entries: CategoryEntry[];
  total: number;
  /** ready-to-use CSS conic-gradient stops for the donut */
  conic: string;
}

export function categoryBreakdown(
  purchases: Purchase[],
  rates: Rates,
): CategoryBreakdown {
  const map: Record<string, number> = {};
  purchases.forEach((p) => {
    // "my spend by category": only my share of shared purchases
    const tot = p.amount * rate(rates, p.currency) * ownFraction(p);
    map[p.category] = (map[p.category] || 0) + tot;
  });
  const raw = Object.keys(map)
    .map((k) => ({ name: k, amount: map[k], color: catColor(k) }))
    .sort((a, b) => b.amount - a.amount);
  const total = raw.reduce((s, e) => s + e.amount, 0);

  let acc = 0;
  const stops: string[] = [];
  const entries: CategoryEntry[] = raw.map((e) => {
    const start = total > 0 ? (acc / total) * 360 : 0;
    acc += e.amount;
    const end = total > 0 ? (acc / total) * 360 : 0;
    stops.push(`${e.color} ${start}deg ${end}deg`);
    return {
      name: e.name,
      amount: e.amount,
      color: e.color,
      pct: total > 0 ? e.amount / total : 0,
    };
  });

  return {
    entries,
    total,
    conic: entries.length ? `conic-gradient(${stops.join(",")})` : "#eee",
  };
}

/** Card display number, e.g. "•••• •••• •••• 1099". */
export function maskedNumber(last4: string): string {
  return "•••• •••• •••• " + last4;
}
