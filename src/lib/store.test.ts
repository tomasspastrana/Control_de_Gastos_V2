import { describe, expect, it } from "vitest";
import { reducer } from "./store";
import type { AppData, Card, Debt, Purchase, StatementSnapshot } from "./types";

const snap = (over: Partial<StatementSnapshot> = {}): StatementSnapshot => ({
  id: "s1", cardId: "c1", period: "2026-07-01", nickname: "A",
  closingDate: "2026-07-30", dueDate: "2026-08-07", total: 10,
  items: [{ label: "m", sub: "cuota 3/6", amount: 10, kind: "purchase", purchaseId: "p1" }],
  paidAt: "2026-07-08", ...over,
});

const base = (): AppData => ({
  rates: { ARS: 1, USD: 1000, EUR: 1200 },
  cards: [{ id: "c1", nickname: "A", holder: "x", brand: "visa", last4: "1", limit: 100, limitCurrency: "ARS", expiry: "", theme: "violet" }],
  purchases: [{ id: "p1", cardId: "c1", merchant: "m", amount: 10, currency: "ARS", installments: 6, paidInstallments: 2, category: "Otros", date: "2026-01-01", sharedWith: null, myPct: 100 }],
  debts: [{ id: "d1", creditor: "j", note: "", amount: 100, currency: "ARS", installments: 4, paidInstallments: 1 }],
  fixedExpenses: [],
  snapshots: [],
});

describe("reducer", () => {
  it("ADD_CARD appends", () => {
    const card = { id: "c2" } as Card;
    expect(reducer(base(), { type: "ADD_CARD", card }).cards).toHaveLength(2);
  });

  it("DELETE_CARD also removes its purchases", () => {
    const s = reducer(base(), { type: "DELETE_CARD", id: "c1" });
    expect(s.cards).toHaveLength(0);
    expect(s.purchases).toHaveLength(0);
  });

  it("ADD_PURCHASE / DELETE_PURCHASE", () => {
    const purchase = { id: "p2", cardId: "c1" } as Purchase;
    let s = reducer(base(), { type: "ADD_PURCHASE", purchase });
    expect(s.purchases).toHaveLength(2);
    s = reducer(s, { type: "DELETE_PURCHASE", id: "p2" });
    expect(s.purchases).toHaveLength(1);
  });

  it("PAY_DELTA clamps between 0 and installments", () => {
    const paid = (s: AppData) => s.purchases[0].paidInstallments;
    expect(paid(reducer(base(), { type: "PAY_DELTA", id: "p1", delta: 1 }))).toBe(3);
    // cannot exceed installments (6)
    let s = base();
    for (let i = 0; i < 10; i++) s = reducer(s, { type: "PAY_DELTA", id: "p1", delta: 1 });
    expect(paid(s)).toBe(6);
    // cannot go below 0
    s = base();
    for (let i = 0; i < 10; i++) s = reducer(s, { type: "PAY_DELTA", id: "p1", delta: -1 });
    expect(paid(s)).toBe(0);
  });

  it("PAY_CARD saves the snapshot, advances only the purchases it billed, and stamps lastPaymentAt", () => {
    // 2/6 → 3/6 after paying the statement once (p1 is one of its lines)
    const s = reducer(base(), { type: "PAY_CARD", cardId: "c1", at: "2026-07-08", snapshot: snap() });
    expect(s.purchases[0].paidInstallments).toBe(3);
    expect(s.cards[0].lastPaymentAt).toBe("2026-07-08");
    expect(s.snapshots).toHaveLength(1);
    // a statement made only of fixed expenses touches no purchase
    const onlyFixed = snap({ items: [{ label: "Netflix", sub: "gasto fijo", amount: 5, kind: "fixed" }] });
    const s2 = reducer(base(), { type: "PAY_CARD", cardId: "c1", at: "2026-07-08", snapshot: onlyFixed });
    expect(s2.purchases[0].paidInstallments).toBe(2);
  });

  it("UNDO_PAY_CARD rolls back exactly what the snapshot advanced", () => {
    const paid = reducer(base(), { type: "PAY_CARD", cardId: "c1", at: "2026-07-08", snapshot: snap() });
    const undone = reducer(paid, { type: "UNDO_PAY_CARD", cardId: "c1", period: "2026-07-01" });
    expect(undone.purchases[0].paidInstallments).toBe(2);
    expect(undone.cards[0].lastPaymentAt).toBeNull();
    expect(undone.snapshots).toHaveLength(0);
  });

  it("UNDO_PAY_CARD on a period with no snapshot is a no-op", () => {
    const s = base();
    expect(reducer(s, { type: "UNDO_PAY_CARD", cardId: "c1", period: "2026-06-01" })).toBe(s);
  });

  it("debt actions: add, delete, clamped pay", () => {
    const debt = { id: "d2" } as Debt;
    let s = reducer(base(), { type: "ADD_DEBT", debt });
    expect(s.debts).toHaveLength(2);
    s = reducer(s, { type: "DELETE_DEBT", id: "d2" });
    expect(s.debts).toHaveLength(1);
    s = reducer(s, { type: "PAY_DEBT_DELTA", id: "d1", delta: -5 });
    expect(s.debts[0].paidInstallments).toBe(0);
  });

  it("SET_RATES merges", () => {
    const s = reducer(base(), { type: "SET_RATES", rates: { USD: 1500 } });
    expect(s.rates.USD).toBe(1500);
    expect(s.rates.EUR).toBe(1200);
  });

  it("does not mutate the previous state", () => {
    const prev = base();
    reducer(prev, { type: "PAY_DELTA", id: "p1", delta: 1 });
    expect(prev.purchases[0].paidInstallments).toBe(2);
  });
});
