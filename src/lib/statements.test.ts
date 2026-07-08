import { describe, expect, it } from "vitest";
import { cardStatement, generalStatement } from "./statements";
import { parseYmd } from "./closing";
import type { Card, FixedExpense, Purchase, Rates } from "./types";

const rates: Rates = { ARS: 1, USD: 1000, EUR: 1200 };

// Ualá-style: fixed day 30, business-adjust, pays 8 days after closing
const card: Card = {
  id: "c1", nickname: "Ualá", holder: "X", brand: "visa", last4: "0001",
  limit: 1_000_000, limitCurrency: "ARS", expiry: "01/30", theme: "violet",
  closingRuleType: "fixed_day", closingDay: 30, closingBusinessAdjust: true, dueDays: 8,
};

const p = (over: Partial<Purchase>): Purchase => ({
  id: "p", cardId: "c1", merchant: "m", amount: 30_000, currency: "ARS",
  installments: 3, paidInstallments: 0, category: "Otros", date: "2026-06-10", ...over,
});

const from = parseYmd("2026-06-01"); // fija el "hoy" para tests deterministas

describe("cardStatement", () => {
  it("only shows PENDING installments; paid ones don't appear", () => {
    // compra 10-jun en 3 cuotas → resúmenes jun, jul, ago; 1 cuota pagada
    const purchases = [p({ id: "a", merchant: "Apple", installments: 3, paidInstallments: 1 })];
    const jun = cardStatement(card, purchases, [], rates, 2026, 5, from); // junio (month 5): cuota 1 pagada → vacío
    const jul = cardStatement(card, purchases, [], rates, 2026, 6, from);
    const ago = cardStatement(card, purchases, [], rates, 2026, 7, from);
    expect(jun.items).toHaveLength(0);
    expect(jul.items[0].sub).toBe("cuota 2/3");
    expect(ago.items[0].sub).toBe("cuota 3/3");
  });
  it("fully-paid purchase never appears", () => {
    const purchases = [p({ installments: 6, paidInstallments: 6, date: "2025-12-10" })];
    const jul = cardStatement(card, purchases, [], rates, 2026, 6, from);
    expect(jul.items).toHaveLength(0);
  });
  it("month with no installment of this purchase → empty statement", () => {
    const may = cardStatement(card, [p({ installments: 3, date: "2026-06-10" })], [], rates, 2026, 4, from); // mayo, antes de la compra
    expect(may.items).toHaveLength(0);
  });
  it("includes active fixed expenses from the current month onward; due date computed", () => {
    const fixed: FixedExpense[] = [
      { id: "f", cardId: "c1", name: "Netflix", amount: 5000, currency: "ARS", category: "Ocio", active: true, occupiesLimit: true },
      { id: "g", cardId: "c1", name: "Off", amount: 9999, currency: "ARS", category: "Ocio", active: false, occupiesLimit: true },
    ];
    const jul = cardStatement(card, [p({ installments: 3, paidInstallments: 1, date: "2026-06-10" })], fixed, rates, 2026, 6, from);
    // cuota 2/3 (10.000) + Netflix (5.000); el pausado no cuenta
    expect(jul.total).toBe(15_000);
    expect(jul.due && jul.due.getMonth()).toBe(7); // vence en agosto (30-jul + 8)
  });
  it("skips fixed expenses in past months", () => {
    const fixed: FixedExpense[] = [
      { id: "f", cardId: "c1", name: "Netflix", amount: 5000, currency: "ARS", category: "Ocio", active: true, occupiesLimit: true },
    ];
    const may = cardStatement(card, [], fixed, rates, 2026, 4, from); // mayo < junio (from)
    expect(may.items).toHaveLength(0);
  });
});

describe("generalStatement", () => {
  it("sums the statements of every card with pending items in the month", () => {
    const card2: Card = { ...card, id: "c2", nickname: "Otra" };
    const purchases = [
      p({ id: "a", cardId: "c1", amount: 30_000, installments: 3, paidInstallments: 0 }),
      p({ id: "b", cardId: "c2", amount: 60_000, installments: 3, paidInstallments: 0 }),
    ];
    const g = generalStatement([card, card2], purchases, [], rates, 2026, 5, from);
    expect(g.perCard).toHaveLength(2);
    expect(g.total).toBe(10_000 + 20_000); // una cuota de cada una
  });
});
