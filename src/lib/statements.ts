// Derived monthly statements ("resúmenes"). Two things place an installment, and the later one
// wins: how many cuotas are already paid (the next unpaid one lands in the CURRENT statement,
// offset 0), and the purchase's own date — nothing can be billed before the first closing on or
// after it, so a purchase made the day after the card closed waits for the next statement.
// The date only ever pushes an installment FORWARD, never back: a backdated purchase loaded with
// "cuotas pagadas" still resumes from where the user says it is.
// Recurring fixed expenses appear in every statement.

import type { Card, Debt, FixedExpense, Purchase, Rates, StatementSnapshot } from "./types";
import { debtsMonthly, fixedMonthly, purchaseInstallment, rate } from "./calc";
import {
  addDays,
  closingSpan,
  currentDueClosing,
  dueDate,
  forwardClosingInMonth,
  lastClosingOnOrBefore,
  nextClosing,
  parseYmd,
  purchaseStatement,
  ruleFromCard,
  type ClosingRule,
  ymd,
} from "./closing";

export interface StatementItem {
  label: string;
  sub: string;
  amount: number; // ARS
  kind: "purchase" | "fixed";
  purchaseId?: string; // set for purchase items → the installment "Pagar tarjeta" advances
}

export interface CardStatement {
  cardId: string;
  nickname: string;
  closing: Date | null; // null = this card has no statement in the month
  due: Date | null;
  items: StatementItem[];
  total: number;
}

/** First closing that can bill this purchase — the first one on/after the day it was made. */
function firstClosingOf(rule: ClosingRule, p: Pick<Purchase, "date">): Date {
  return purchaseStatement(rule, parseYmd(p.date), null).closing;
}

/**
 * The closing whose statement bills this purchase's next cuota: the card's anchor, unless the
 * purchase is younger than it (bought after the card closed) and has to wait for a later one.
 * Takes just the date so the "where would this land?" preview in the new-purchase form can use
 * the very same rule the scheduler does.
 */
export function purchaseNextClosing(
  rule: ClosingRule,
  p: Pick<Purchase, "date">,
  cardAnchor: Date,
): Date {
  const first = firstClosingOf(rule, p);
  return first > cardAnchor ? first : cardAnchor;
}

function fixedItem(f: FixedExpense, rates: Rates): StatementItem {
  return {
    label: f.name,
    sub: f.occupiesLimit ? "gasto fijo" : "gasto fijo · no ocupa límite",
    amount: f.amount * rate(rates, f.currency),
    kind: "fixed",
  };
}

/**
 * One card's statement for calendar (year, month), anchored to `from` (today).
 * `offset` (0 = current/next closing) decides which installment number of each purchase falls
 * here: the (paidInstallments + 1 + offset)-th, as long as it's still pending — capped per
 * purchase so nothing is billed before its own first closing.
 */
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

  // anchor offset 0 on the resumen actually due now (may have closed earlier this month)
  const start = currentDueClosing(rule, from, card.lastPaymentAt ?? null, card.createdAt ?? null);
  const found = forwardClosingInMonth(rule, year, month, from, start);
  if (!found) return { ...base, closing: null, due: null, items: [], total: 0 };
  const { closing, offset } = found;

  const items: StatementItem[] = [];
  for (const p of purchases) {
    if (p.cardId !== card.id) continue;
    const remaining = p.installments - p.paidInstallments;
    // a purchase counts statements from its own first closing when that's later than the card's
    // anchor; `min` keeps the paid-installments anchor winning for everything older
    const pOffset = Math.min(offset, closingSpan(firstClosingOf(rule, p), closing));
    if (pOffset >= 0 && pOffset < remaining) {
      const cuota = p.paidInstallments + 1 + pOffset;
      items.push({
        label: p.merchant,
        sub: `cuota ${cuota}/${p.installments}`,
        amount: purchaseInstallment(p, rates),
        kind: "purchase",
        purchaseId: p.id,
      });
    }
  }

  // recurring fixed expenses appear in every (present/future) statement
  for (const f of fixed) {
    if (f.cardId === card.id && f.active) items.push(fixedItem(f, rates));
  }

  const total = items.reduce((s, i) => s + i.amount, 0);
  const due = card.dueDays != null ? dueDate(closing, card.dueDays) : null;
  return { ...base, closing, due, items, total };
}

/**
 * The statement billed at an explicit `closing` date: cuota #(paidInstallments+1) of every
 * pending purchase that has already reached this statement + the card's active fixed expenses.
 * Takes the closing as an argument so callers that already know which statement they mean
 * (e.g. the one being paid) don't have to re-derive it and risk disagreeing.
 * `closing = null` for cards without a billing cycle — nothing to defer against there.
 */
export function statementAt(
  card: Card,
  purchases: Purchase[],
  fixed: FixedExpense[],
  rates: Rates,
  closing: Date | null,
): CardStatement {
  const rule = ruleFromCard(card);
  const items: StatementItem[] = [];
  for (const p of purchases) {
    if (p.cardId !== card.id || p.paidInstallments >= p.installments) continue;
    // bought after this statement closed → it lands in a later one (this is `cardStatement`'s
    // rule at offset 0, where the only thing `min` can do is defer)
    if (rule && closing && closingSpan(firstClosingOf(rule, p), closing) < 0) continue;
    items.push({
      label: p.merchant,
      sub: `cuota ${p.paidInstallments + 1}/${p.installments}`,
      amount: purchaseInstallment(p, rates),
      kind: "purchase",
      purchaseId: p.id,
    });
  }
  for (const f of fixed) {
    if (f.cardId === card.id && f.active) items.push(fixedItem(f, rates));
  }

  const total = items.reduce((s, i) => s + i.amount, 0);
  const due = closing && card.dueDays != null ? dueDate(closing, card.dueDays) : null;
  return { cardId: card.id, nickname: card.nickname, closing, due, items, total };
}

/**
 * The card's "current statement to pay" — `statementAt` anchored on the resumen actually due
 * now (`currentDueClosing`). This is what "A pagar este mes" uses, and it matches the current
 * month in Resúmenes. Cards without a billing cycle fall back to the same shape without dates.
 */
export function currentStatement(
  card: Card,
  purchases: Purchase[],
  fixed: FixedExpense[],
  rates: Rates,
  from: Date = new Date(),
): CardStatement {
  const rule = ruleFromCard(card);
  const closing = rule ? currentDueClosing(rule, from, card.lastPaymentAt ?? null, card.createdAt ?? null) : null;
  return statementAt(card, purchases, fixed, rates, closing);
}

export interface GeneralStatement {
  total: number;
  perCard: CardStatement[]; // only cards with something billed in the month
}

/** Combined statement for a month: every card with items in it, plus the grand total. */
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

export interface AmountDue {
  cards: number; // sum of every card's current statement (cuota + fixed charged to the card)
  debts: number; // one installment per unpaid personal debt
  fixed: number; // standalone fixed expenses (not charged to any card)
  total: number;
}

/**
 * "A pagar este mes": what's actually due now across everything —
 * each card's current statement (never dropped just because it already closed this month) +
 * personal debts' monthly installment + standalone fixed expenses. Card-linked fixed expenses
 * are already inside each card's statement, so only standalone ones are added here.
 */
export function amountDueThisMonth(
  cards: Card[],
  purchases: Purchase[],
  fixed: FixedExpense[],
  debts: Debt[],
  rates: Rates,
  from: Date = new Date(),
): AmountDue {
  const cardsTotal = cards.reduce(
    (s, c) => s + currentStatement(c, purchases, fixed, rates, from).total,
    0,
  );
  const debtsTotal = debtsMonthly(debts, rates);
  const standaloneFixed = fixed.filter((f) => f.cardId === null && f.active);
  const fixedTotal = fixedMonthly(standaloneFixed, rates);
  return { cards: cardsTotal, debts: debtsTotal, fixed: fixedTotal, total: cardsTotal + debtsTotal + fixedTotal };
}

/** yyyy-mm-01 label for a 0-based (year, month) — the period key of a snapshot. */
export function periodKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/**
 * Where a card stands with respect to paying its statement. A statement can only be paid once
 * it has closed, and only once: the saved snapshot for its period IS the "already paid" record,
 * so this never depends on `lastPaymentAt` (which says when, not what).
 *  - `no-rule`     → no billing cycle configured, nothing to pay against
 *  - `not-closed`  → no closing behind us since the card was added (brand-new card)
 *  - `payable`     → the last closing's statement has no snapshot → pay it
 *  - `paid`        → it's already in history; the next one opens at `nextClosing`
 */
export type PayState =
  | { kind: "no-rule" }
  | { kind: "not-closed"; nextClosing: Date }
  | { kind: "payable"; closing: Date; due: Date | null; period: string; stmt: CardStatement }
  | { kind: "paid"; closing: Date; period: string; snapshot: StatementSnapshot; nextClosing: Date };

export function statementPayState(
  card: Card,
  purchases: Purchase[],
  fixed: FixedExpense[],
  rates: Rates,
  snapshots: StatementSnapshot[],
  from: Date = new Date(),
): PayState {
  const rule = ruleFromCard(card);
  if (!rule) return { kind: "no-rule" };

  const closing = lastClosingOnOrBefore(rule, from);
  // a closing from before the card was added is not a statement of ours to pay
  if (!closing || (card.createdAt && closing < parseYmd(card.createdAt))) {
    return { kind: "not-closed", nextClosing: nextClosing(rule, from) };
  }

  const period = periodKey(closing.getFullYear(), closing.getMonth());
  const snapshot = snapshots.find((s) => s.cardId === card.id && s.period === period);
  if (snapshot) {
    return { kind: "paid", closing, period, snapshot, nextClosing: nextClosing(rule, addDays(closing, 1)) };
  }

  const stmt = statementAt(card, purchases, fixed, rates, closing);
  return { kind: "payable", closing, due: stmt.due, period, stmt };
}

/**
 * Freeze a statement into a history row at payment time. The period is the month the statement
 * CLOSED in (not the month it's paid in), which is where the Resúmenes tab looks it up.
 * `purchaseId` is kept on each line so "Deshacer pago" can roll back exactly what it advanced.
 */
export function buildPaidSnapshot(
  card: Card,
  stmt: CardStatement,
  closing: Date,
  paidAt: string,
): Omit<StatementSnapshot, "id"> {
  return {
    cardId: card.id,
    period: periodKey(closing.getFullYear(), closing.getMonth()),
    nickname: card.nickname,
    closingDate: ymd(closing),
    dueDate: stmt.due ? ymd(stmt.due) : null,
    total: stmt.total,
    items: stmt.items.map((i) => ({
      label: i.label,
      sub: i.sub,
      amount: i.amount,
      kind: i.kind,
      ...(i.purchaseId ? { purchaseId: i.purchaseId } : {}),
    })),
    paidAt,
  };
}
