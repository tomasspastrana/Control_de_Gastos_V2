// Server-side data loader: reads one user's data from Postgres and maps
// DB rows to the domain types the UI already uses (AppData).

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards as cardsT, debts as debtsT, fixedExpenses as fixedT, profiles as profilesT, purchases as purchasesT } from "@/db/schema";
import type { AppData, Card, Debt, FixedExpense, Purchase } from "@/lib/types";
import type { CardRow, DebtRow, FixedExpenseRow, PurchaseRow } from "@/db/schema";

function toCard(r: CardRow): Card {
  return {
    id: r.id,
    nickname: r.nickname,
    holder: r.holder,
    brand: r.brand,
    last4: r.last4,
    limit: r.limitAmount,
    limitCurrency: r.limitCurrency,
    expiry: r.expiry,
    theme: r.theme,
    issuer: r.issuer,
    closingRuleType: r.closingRuleType,
    closingDay: r.closingDay,
    closingBusinessAdjust: r.closingBusinessAdjust,
    closingAnchor: r.closingAnchor,
    closingNextGap: r.closingNextGap,
    dueDays: r.dueDays,
  };
}

function toPurchase(r: PurchaseRow): Purchase {
  return {
    id: r.id,
    cardId: r.cardId,
    merchant: r.merchant,
    amount: r.amount,
    currency: r.currency,
    installments: r.installments,
    paidInstallments: r.paidInstallments,
    category: r.category,
    date: r.date,
  };
}

function toDebt(r: DebtRow): Debt {
  return {
    id: r.id,
    creditor: r.creditor,
    note: r.note,
    amount: r.amount,
    currency: r.currency,
    installments: r.installments,
    paidInstallments: r.paidInstallments,
  };
}

function toFixedExpense(r: FixedExpenseRow): FixedExpense {
  return {
    id: r.id,
    cardId: r.cardId,
    name: r.name,
    amount: r.amount,
    currency: r.currency,
    category: r.category,
    active: r.active,
    occupiesLimit: r.occupiesLimit,
  };
}

/** Loads everything the dashboard needs for one user, isolated by user_id. */
export async function getAppData(userId: string): Promise<AppData> {
  const [profile] = await db.select().from(profilesT).where(eq(profilesT.id, userId));

  const [cardRows, purchaseRows, debtRows, fixedRows] = await Promise.all([
    db.select().from(cardsT).where(eq(cardsT.userId, userId)).orderBy(asc(cardsT.createdAt)),
    db.select().from(purchasesT).where(eq(purchasesT.userId, userId)).orderBy(asc(purchasesT.createdAt)),
    db.select().from(debtsT).where(eq(debtsT.userId, userId)).orderBy(asc(debtsT.createdAt)),
    db.select().from(fixedT).where(eq(fixedT.userId, userId)).orderBy(asc(fixedT.createdAt)),
  ]);

  return {
    rates: { ARS: 1, USD: profile?.rateUsd ?? 1015, EUR: profile?.rateEur ?? 1120 },
    cards: cardRows.map(toCard),
    purchases: purchaseRows.map(toPurchase),
    debts: debtRows.map(toDebt),
    fixedExpenses: fixedRows.map(toFixedExpense),
  };
}

// re-exported for actions that need to double-check ownership
export { and, eq };
