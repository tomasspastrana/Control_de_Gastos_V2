import { describe, expect, it } from "vitest";
import { cardStatement, generalStatement } from "./statements";
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

describe("cardStatement", () => {
  it("distributes a purchase's installments across consecutive statements", () => {
    // compra 10-jun en 3 cuotas → resúmenes jun, jul, ago
    const purchases = [p({ id: "a", merchant: "Apple", installments: 3, paidInstallments: 1 })];
    const jun = cardStatement(card, purchases, [], rates, 2026, 5); // junio (month 5)
    const jul = cardStatement(card, purchases, [], rates, 2026, 6);
    expect(jun.items).toHaveLength(1);
    expect(jun.items[0].sub).toBe("cuota 1/3");
    expect(jun.items[0].paid).toBe(true); // 1 cuota pagada → la #1 está paga
    expect(jun.total).toBe(10_000);
    expect(jul.items[0].sub).toBe("cuota 2/3");
    expect(jul.items[0].paid).toBe(false);
  });
  it("month with no installment of this purchase → empty statement", () => {
    const may = cardStatement(card, [p({ installments: 3, date: "2026-06-10" })], [], rates, 2026, 4); // mayo, antes de la compra
    expect(may.items).toHaveLength(0);
    expect(may.total).toBe(0);
  });
  it("includes active fixed expenses every month; due date computed", () => {
    const fixed: FixedExpense[] = [
      { id: "f", cardId: "c1", name: "Netflix", amount: 5000, currency: "ARS", category: "Ocio", active: true, occupiesLimit: true },
      { id: "g", cardId: "c1", name: "Off", amount: 9999, currency: "ARS", category: "Ocio", active: false, occupiesLimit: true },
    ];
    const jul = cardStatement(card, [p({ installments: 3, date: "2026-06-10" })], fixed, rates, 2026, 6);
    // cuota 2/3 (10.000) + Netflix (5.000); el pausado no cuenta
    expect(jul.total).toBe(15_000);
    expect(jul.due && jul.due.getMonth()).toBe(7); // vence en agosto (30-jul + 8)
  });
});

describe("generalStatement", () => {
  it("sums the statements of every card that closes in the month", () => {
    const card2: Card = { ...card, id: "c2", nickname: "Otra" };
    const purchases = [
      p({ id: "a", cardId: "c1", amount: 30_000, installments: 3 }),
      p({ id: "b", cardId: "c2", amount: 60_000, installments: 3 }),
    ];
    const g = generalStatement([card, card2], purchases, [], rates, 2026, 5);
    expect(g.perCard).toHaveLength(2);
    expect(g.total).toBe(10_000 + 20_000); // una cuota de cada una
  });
});
