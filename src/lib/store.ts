// Pure reducer for the Tarjetero domain data.
// Kept side-effect-free so it's easy to unit-test and, in Fase 5, mirror on the server.

import type { AppData, Card, Debt, FixedExpense, Purchase, Rates, StatementSnapshot } from "./types";

export type Action =
  | { type: "HYDRATE"; data: AppData }
  | { type: "ADD_CARD"; card: Card }
  | { type: "DELETE_CARD"; id: string }
  | { type: "ADD_PURCHASE"; purchase: Purchase }
  | { type: "EDIT_PURCHASE"; id: string; patch: Partial<Purchase> }
  | { type: "DELETE_PURCHASE"; id: string }
  | { type: "PAY_DELTA"; id: string; delta: number }
  | { type: "PAY_CARD"; cardId: string; at: string; snapshot: StatementSnapshot }
  | { type: "UNDO_PAY_CARD"; cardId: string; period: string }
  | { type: "ADD_DEBT"; debt: Debt }
  | { type: "DELETE_DEBT"; id: string }
  | { type: "PAY_DEBT_DELTA"; id: string; delta: number }
  | { type: "ADD_FIXED"; fixed: FixedExpense }
  | { type: "EDIT_FIXED"; id: string; patch: Partial<FixedExpense> }
  | { type: "DELETE_FIXED"; id: string }
  | { type: "TOGGLE_FIXED"; id: string }
  | { type: "SET_RATES"; rates: Partial<Rates> };

/** The purchases a snapshot advanced one installment on. */
function snapshotPurchaseIds(s: StatementSnapshot): Set<string> {
  return new Set(s.items.map((i) => i.purchaseId).filter((id): id is string => !!id));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "HYDRATE":
      return action.data;

    case "ADD_CARD":
      return { ...state, cards: [...state.cards, action.card] };

    case "DELETE_CARD":
      return {
        ...state,
        cards: state.cards.filter((c) => c.id !== action.id),
        purchases: state.purchases.filter((p) => p.cardId !== action.id),
        // card-linked fixed expenses cascade away with the card
        fixedExpenses: state.fixedExpenses.filter((f) => f.cardId !== action.id),
      };

    case "ADD_PURCHASE":
      return { ...state, purchases: [...state.purchases, action.purchase] };

    case "EDIT_PURCHASE":
      return {
        ...state,
        purchases: state.purchases.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
      };

    case "DELETE_PURCHASE":
      return { ...state, purchases: state.purchases.filter((p) => p.id !== action.id) };

    case "PAY_DELTA":
      return {
        ...state,
        purchases: state.purchases.map((p) =>
          p.id === action.id
            ? { ...p, paidInstallments: clamp(p.paidInstallments + action.delta, 0, p.installments) }
            : p,
        ),
      };

    case "PAY_CARD": {
      // paying freezes the statement into history and advances one installment on exactly the
      // purchases it billed; the snapshot is also what marks the statement as already paid
      const ids = snapshotPurchaseIds(action.snapshot);
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.cardId ? { ...c, lastPaymentAt: action.at } : c,
        ),
        purchases: state.purchases.map((p) =>
          ids.has(p.id)
            ? { ...p, paidInstallments: clamp(p.paidInstallments + 1, 0, p.installments) }
            : p,
        ),
        snapshots: [...state.snapshots, action.snapshot],
      };
    }

    case "UNDO_PAY_CARD": {
      const snap = state.snapshots.find(
        (s) => s.cardId === action.cardId && s.period === action.period,
      );
      if (!snap) return state;
      const ids = snapshotPurchaseIds(snap);
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === action.cardId ? { ...c, lastPaymentAt: null } : c)),
        purchases: state.purchases.map((p) =>
          ids.has(p.id)
            ? { ...p, paidInstallments: clamp(p.paidInstallments - 1, 0, p.installments) }
            : p,
        ),
        snapshots: state.snapshots.filter((s) => s !== snap),
      };
    }

    case "ADD_DEBT":
      return { ...state, debts: [...state.debts, action.debt] };

    case "DELETE_DEBT":
      return { ...state, debts: state.debts.filter((d) => d.id !== action.id) };

    case "PAY_DEBT_DELTA":
      return {
        ...state,
        debts: state.debts.map((d) =>
          d.id === action.id
            ? { ...d, paidInstallments: clamp(d.paidInstallments + action.delta, 0, d.installments) }
            : d,
        ),
      };

    case "ADD_FIXED":
      return { ...state, fixedExpenses: [...state.fixedExpenses, action.fixed] };

    case "EDIT_FIXED":
      return {
        ...state,
        fixedExpenses: state.fixedExpenses.map((f) =>
          f.id === action.id ? { ...f, ...action.patch } : f,
        ),
      };

    case "DELETE_FIXED":
      return { ...state, fixedExpenses: state.fixedExpenses.filter((f) => f.id !== action.id) };

    case "TOGGLE_FIXED":
      return {
        ...state,
        fixedExpenses: state.fixedExpenses.map((f) =>
          f.id === action.id ? { ...f, active: !f.active } : f,
        ),
      };

    case "SET_RATES":
      return { ...state, rates: { ...state.rates, ...action.rates } };

    default:
      return state;
  }
}
