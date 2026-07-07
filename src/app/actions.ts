"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cards, debts, profiles, purchases } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { cardSchema, closingConfigSchema, debtSchema, purchaseSchema, ratesSchema } from "@/lib/schemas";

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return user.id;
}

function done() {
  revalidatePath("/");
}

// ---------- cards ----------
export async function createCard(input: unknown) {
  const userId = await requireUserId();
  const d = cardSchema.parse(input);
  await db.insert(cards).values({
    userId,
    nickname: d.nickname,
    holder: d.holder || "—",
    brand: d.brand,
    last4: (d.last4 || "0000").padStart(4, "0").slice(-4),
    limitAmount: d.limit,
    limitCurrency: d.limitCurrency,
    expiry: d.expiry || "--/--",
    theme: d.theme,
    issuer: d.issuer ?? null,
    closingRuleType: d.closingRuleType ?? null,
    closingDay: d.closingDay ?? null,
    closingBusinessAdjust: d.closingBusinessAdjust ?? false,
    closingAnchor: d.closingAnchor ?? null,
    closingNextGap: d.closingNextGap ?? null,
    dueDays: d.dueDays ?? null,
  });
  done();
}

/** Configure / re-anchor a card's closing rule. */
export async function updateCardClosing(cardId: string, input: unknown) {
  const userId = await requireUserId();
  const d = closingConfigSchema.parse(input);
  await db
    .update(cards)
    .set({
      closingRuleType: d.closingRuleType ?? null,
      closingDay: d.closingDay ?? null,
      closingBusinessAdjust: d.closingBusinessAdjust ?? false,
      closingAnchor: d.closingAnchor ?? null,
      closingNextGap: d.closingNextGap ?? null,
      dueDays: d.dueDays ?? null,
    })
    .where(and(eq(cards.id, cardId), eq(cards.userId, userId)));
  done();
}

export async function deleteCard(id: string) {
  const userId = await requireUserId();
  // purchases are removed via ON DELETE CASCADE
  await db.delete(cards).where(and(eq(cards.id, id), eq(cards.userId, userId)));
  done();
}

// ---------- purchases ----------
export async function createPurchase(input: unknown) {
  const userId = await requireUserId();
  const d = purchaseSchema.parse(input);
  // ownership of the card is enforced by RLS + the user_id we write
  await db.insert(purchases).values({
    userId,
    cardId: d.cardId,
    merchant: d.merchant || "Compra",
    amount: d.amount,
    currency: d.currency,
    installments: d.installments,
    paidInstallments: d.paidInstallments,
    category: d.category,
    date: d.date,
  });
  done();
}

export async function deletePurchase(id: string) {
  const userId = await requireUserId();
  await db.delete(purchases).where(and(eq(purchases.id, id), eq(purchases.userId, userId)));
  done();
}

export async function payPurchaseDelta(id: string, delta: number) {
  const userId = await requireUserId();
  await db
    .update(purchases)
    .set({
      paidInstallments: sql`least(${purchases.installments}, greatest(0, ${purchases.paidInstallments} + ${delta}))`,
    })
    .where(and(eq(purchases.id, id), eq(purchases.userId, userId)));
  done();
}

export async function payCard(cardId: string) {
  const userId = await requireUserId();
  await db
    .update(purchases)
    .set({ paidInstallments: sql`${purchases.installments}` })
    .where(and(eq(purchases.cardId, cardId), eq(purchases.userId, userId)));
  done();
}

// ---------- debts ----------
export async function createDebt(input: unknown) {
  const userId = await requireUserId();
  const d = debtSchema.parse(input);
  await db.insert(debts).values({
    userId,
    creditor: d.creditor,
    note: d.note,
    amount: d.amount,
    currency: d.currency,
    installments: d.installments,
    paidInstallments: d.paidInstallments,
  });
  done();
}

export async function deleteDebt(id: string) {
  const userId = await requireUserId();
  await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  done();
}

export async function payDebtDelta(id: string, delta: number) {
  const userId = await requireUserId();
  await db
    .update(debts)
    .set({
      paidInstallments: sql`least(${debts.installments}, greatest(0, ${debts.paidInstallments} + ${delta}))`,
    })
    .where(and(eq(debts.id, id), eq(debts.userId, userId)));
  done();
}

// ---------- settings (exchange rates on the profile) ----------
export async function saveRates(input: unknown) {
  const userId = await requireUserId();
  const { usd, eur } = ratesSchema.parse(input);
  await db
    .insert(profiles)
    .values({ id: userId, rateUsd: usd, rateEur: eur })
    .onConflictDoUpdate({ target: profiles.id, set: { rateUsd: usd, rateEur: eur } });
  done();
}
