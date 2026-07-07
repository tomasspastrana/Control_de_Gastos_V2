// Business logic ported 1:1 from the prototype (reference/prototype.html).
// Pure functions only — easy to unit-test and reuse on client & server.

import type { Card, Currency, Purchase, Rates, ThemeName } from "./types";

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
export interface CardMetrics {
  debt: number;
  limit: number;
  avail: number;
  pct: number;
  count: number;
}

/**
 * Total amount (in ARS) that a purchase commits to the card limit.
 * If the real installment value is set (which already includes bank interest),
 * total = installmentValue × installments; otherwise it falls back to the price.
 */
export function purchaseTotalArs(p: Purchase, rates: Rates): number {
  const base =
    p.installmentValue && p.installmentValue > 0
      ? p.installmentValue * p.installments
      : p.amount;
  return base * rate(rates, p.currency);
}

/** Remaining debt (in ARS) of a single purchase given its installment progress. */
export function purchaseRemaining(p: Purchase, rates: Rates): number {
  const tot = purchaseTotalArs(p, rates);
  return (tot * (p.installments - p.paidInstallments)) / (p.installments || 1);
}

/** Aggregate metrics for one card, in ARS. */
export function cardMetrics(
  card: Card,
  purchases: Purchase[],
  rates: Rates,
): CardMetrics {
  const ps = purchases.filter((p) => p.cardId === card.id);
  let debt = 0;
  ps.forEach((p) => {
    debt += purchaseRemaining(p, rates);
  });
  const limit = card.limit * rate(rates, card.limitCurrency || "ARS");
  const avail = limit - debt;
  const pct = limit > 0 ? Math.min(1, debt / limit) : 0;
  return { debt, limit, avail, pct, count: ps.length };
}

export interface Totals {
  debt: number;
  limit: number;
  avail: number;
}

export function totals(
  cards: Card[],
  purchases: Purchase[],
  rates: Rates,
): Totals {
  let debt = 0,
    limit = 0,
    avail = 0;
  cards.forEach((c) => {
    const m = cardMetrics(c, purchases, rates);
    debt += m.debt;
    limit += m.limit;
    avail += m.avail;
  });
  return { debt, limit, avail };
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
    const tot = purchaseTotalArs(p, rates);
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
