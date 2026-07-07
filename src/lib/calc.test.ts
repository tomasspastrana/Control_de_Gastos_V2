import { describe, expect, it } from "vitest";
import {
  cardMetrics,
  categoryBreakdown,
  fixedMonthly,
  purchaseRemaining,
  totals,
} from "./calc";
import type { Card, FixedExpense, Purchase, Rates } from "./types";

const rates: Rates = { ARS: 1, USD: 1000, EUR: 1200 };

const card: Card = {
  id: "c1",
  nickname: "Test",
  holder: "X",
  brand: "visa",
  last4: "0001",
  limit: 1_000_000,
  limitCurrency: "ARS",
  expiry: "01/30",
  theme: "violet",
};

const p = (over: Partial<Purchase>): Purchase => ({
  id: "p",
  cardId: "c1",
  merchant: "m",
  amount: 1000,
  currency: "USD",
  installments: 12,
  paidInstallments: 3,
  category: "Tecnología",
  date: "2026-01-01",
  ...over,
});

describe("purchaseRemaining", () => {
  it("converts to ARS and prorates by unpaid installments", () => {
    // 1000 USD * 1000 = 1,000,000 ARS total; 9/12 unpaid = 750,000
    expect(purchaseRemaining(p({}), rates)).toBe(750_000);
  });
  it("is zero when fully paid", () => {
    expect(purchaseRemaining(p({ paidInstallments: 12 }), rates)).toBe(0);
  });
});

describe("cardMetrics", () => {
  it("aggregates debt / avail / pct against the limit", () => {
    const m = cardMetrics(card, [p({})], rates);
    expect(m.debt).toBe(750_000);
    expect(m.limit).toBe(1_000_000);
    expect(m.avail).toBe(250_000);
    expect(m.pct).toBeCloseTo(0.75);
    expect(m.count).toBe(1);
  });
  it("sums one installment per still-owing purchase into monthly", () => {
    const m = cardMetrics(
      card,
      [
        p({ id: "a" }), // 1,000,000 / 12 = 83,333.33
        p({ id: "b", amount: 600, installments: 6 }), // 600,000 / 6 = 100,000
        p({ id: "c", paidInstallments: 12 }), // fully paid → excluded
      ],
      rates,
    );
    expect(m.monthly).toBeCloseTo(1_000_000 / 12 + 100_000);
  });
  it("caps pct at 1 when over limit", () => {
    const m = cardMetrics(card, [p({ amount: 5000 })], rates); // 5,000,000 total
    expect(m.pct).toBe(1);
  });
});

const fx = (over: Partial<FixedExpense>): FixedExpense => ({
  id: "f",
  cardId: "c1",
  name: "Sub",
  amount: 20,
  currency: "USD",
  category: "Ocio",
  active: true,
  ...over,
});

describe("fixedMonthly", () => {
  it("sums only active expenses, converted to ARS", () => {
    const list = [
      fx({ id: "a", amount: 20, currency: "USD" }), // 20,000
      fx({ id: "b", amount: 5000, currency: "ARS" }), // 5,000
      fx({ id: "c", amount: 100, currency: "USD", active: false }), // excluded
    ];
    expect(fixedMonthly(list, rates)).toBe(25_000);
  });
});

describe("cardMetrics with fixed expenses", () => {
  it("adds card-linked active expenses to debt and monthly, occupying limit", () => {
    const m = cardMetrics(
      card,
      [p({ paidInstallments: 12 })], // fully paid → no purchase debt/monthly
      rates,
      [
        fx({ id: "a", cardId: "c1", amount: 20, currency: "USD" }), // 20,000
        fx({ id: "b", cardId: "other", amount: 999, currency: "USD" }), // other card
        fx({ id: "c", cardId: "c1", amount: 10, currency: "USD", active: false }), // paused
      ],
    );
    expect(m.debt).toBe(20_000);
    expect(m.monthly).toBe(20_000);
    expect(m.avail).toBe(1_000_000 - 20_000);
  });
});

describe("totals", () => {
  it("sums metrics across cards", () => {
    const t = totals([card], [p({})], rates);
    expect(t.debt).toBe(750_000);
    expect(t.avail).toBe(250_000);
  });
});

describe("categoryBreakdown", () => {
  it("groups by category, sorts desc, and builds a conic gradient", () => {
    const purchases = [
      p({ id: "a", amount: 100, currency: "USD", category: "Tecnología" }), // 100k
      p({ id: "b", amount: 300, currency: "USD", category: "Viajes" }), // 300k
    ];
    const b = categoryBreakdown(purchases, rates);
    expect(b.total).toBe(400_000);
    expect(b.entries.map((e) => e.name)).toEqual(["Viajes", "Tecnología"]);
    expect(b.entries[0].pct).toBeCloseTo(0.75);
    expect(b.conic.startsWith("conic-gradient(")).toBe(true);
  });
  it("falls back to a flat color with no purchases", () => {
    expect(categoryBreakdown([], rates).conic).toBe("#eee");
  });
});
