// Derived monthly statements ("resúmenes"): computed from purchases' installment
// schedules + recurring fixed expenses + each card's billing cycle. No persistence —
// past/current/future statements are all derivable from the installment calendar.

import type { Card, FixedExpense, Purchase, Rates } from "./types";
import { purchaseInstallment, rate } from "./calc";
import { closingInMonth, dueDate, parseYmd, ruleFromCard, upcomingClosings, ymd } from "./closing";

export interface StatementItem {
  label: string;
  sub: string;
  amount: number; // ARS
  kind: "purchase" | "fixed";
}

export interface CardStatement {
  cardId: string;
  nickname: string;
  closing: Date | null; // null = this card has no statement closing in the month
  due: Date | null;
  items: StatementItem[];
  total: number;
}

/** One card's statement for calendar (year, month). Empty when the card doesn't close that month. */
export function cardStatement(
  card: Card,
  purchases: Purchase[],
  fixed: FixedExpense[],
  rates: Rates,
  year: number,
  month: number,
  from: Date = new Date(),
): CardStatement {
  const rule = ruleFromCard(card);
  const base = { cardId: card.id, nickname: card.nickname };
  if (!rule) return { ...base, closing: null, due: null, items: [], total: 0 };

  const closing = closingInMonth(rule, year, month);
  if (!closing) return { ...base, closing: null, due: null, items: [], total: 0 };

  const key = ymd(closing);
  const items: StatementItem[] = [];

  for (const p of purchases) {
    if (p.cardId !== card.id) continue;
    const closings = upcomingClosings(rule, parseYmd(p.date), p.installments);
    const idx = closings.findIndex((c) => ymd(c) === key);
    // only installments that are still PENDING (paid ones belong to past statements)
    if (idx >= 0 && idx >= p.paidInstallments) {
      items.push({
        label: p.merchant,
        sub: `cuota ${idx + 1}/${p.installments}`,
        amount: purchaseInstallment(p, rates),
        kind: "purchase",
      });
    }
  }

  // recurring fixed expenses only from the current month onward (still to pay)
  const isPast = year * 12 + month < from.getFullYear() * 12 + from.getMonth();
  if (!isPast) {
    for (const f of fixed) {
      if (f.cardId !== card.id || !f.active) continue;
      items.push({
        label: f.name,
        sub: f.occupiesLimit ? "gasto fijo" : "gasto fijo · no ocupa límite",
        amount: f.amount * rate(rates, f.currency),
        kind: "fixed",
      });
    }
  }

  const total = items.reduce((s, i) => s + i.amount, 0);
  const due = card.dueDays != null ? dueDate(closing, card.dueDays) : null;
  return { ...base, closing, due, items, total };
}

export interface GeneralStatement {
  total: number;
  perCard: CardStatement[]; // only cards that close in the month
}

/** Combined statement for a month: every card that closes in it, plus the grand total. */
export function generalStatement(
  cards: Card[],
  purchases: Purchase[],
  fixed: FixedExpense[],
  rates: Rates,
  year: number,
  month: number,
  from: Date = new Date(),
): GeneralStatement {
  const perCard = cards
    .map((c) => cardStatement(c, purchases, fixed, rates, year, month, from))
    .filter((s) => s.items.length > 0);
  const total = perCard.reduce((s, c) => s + c.total, 0);
  return { total, perCard };
}
