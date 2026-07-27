import { describe, expect, it } from "vitest";
import { amountDueThisMonth, cardStatement, currentStatement, generalStatement } from "./statements";
import { parseYmd, ymd } from "./closing";
import type { Card, Debt, FixedExpense, Purchase, Rates } from "./types";

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

const hoy = parseYmd("2026-07-08"); // el 30-jun ya cerró y no se pagó → resumen que vence ahora (offset 0)

describe("cardStatement (anclado al resumen que vence ahora)", () => {
  it("la próxima cuota impaga cae en el resumen que vence ahora (offset 0)", () => {
    // compra vieja (enero) con 2/3 pagadas → cuota 3 en el resumen actual (cierra 30-jun, vence 08-jul)
    const purchases = [p({ id: "a", merchant: "AF Jeans", date: "2026-01-15", installments: 3, paidInstallments: 2 })];
    const jun = cardStatement(card, purchases, [], rates, 2026, 5, hoy); // junio = offset 0
    expect(jun.items).toHaveLength(1);
    expect(jun.items[0].sub).toBe("cuota 3/3");
  });
  it("distribuye las cuotas restantes hacia adelante", () => {
    const purchases = [p({ id: "a", installments: 6, paidInstallments: 2 })]; // faltan 4
    expect(cardStatement(card, purchases, [], rates, 2026, 5, hoy).items[0].sub).toBe("cuota 3/6"); // junio (offset 0)
    expect(cardStatement(card, purchases, [], rates, 2026, 6, hoy).items[0].sub).toBe("cuota 4/6"); // julio (offset 1)
  });
  it("compra saldada no aparece", () => {
    const jun = cardStatement(card, [p({ installments: 6, paidInstallments: 6 })], [], rates, 2026, 5, hoy);
    expect(jun.items).toHaveLength(0);
  });
  it("meses realmente pasados quedan vacíos", () => {
    // mayo es anterior al resumen que vence ahora (30-jun) → vacío
    const may = cardStatement(card, [p({ installments: 3, paidInstallments: 0 })], [], rates, 2026, 4, hoy);
    expect(may.closing).toBeNull();
    expect(may.items).toHaveLength(0);
  });
  it("incluye gastos fijos activos y calcula el vencimiento", () => {
    const fixed: FixedExpense[] = [
      { id: "f", cardId: "c1", name: "Netflix", amount: 5000, currency: "ARS", category: "Ocio", active: true, occupiesLimit: true },
      { id: "g", cardId: "c1", name: "Off", amount: 9999, currency: "ARS", category: "Ocio", active: false, occupiesLimit: true },
    ];
    const jun = cardStatement(card, [p({ installments: 3, paidInstallments: 2 })], fixed, rates, 2026, 5, hoy);
    expect(jun.total).toBe(10_000 + 5_000); // cuota 3 + Netflix; el pausado no cuenta
    expect(jun.due && jun.due.getMonth()).toBe(6); // 30-jun + 8 → 08-jul (julio)
  });
});

describe("cardStatement: un resumen ya cerrado este mes no se pierde (bug 'A pagar de menos')", () => {
  // BBVA-style: cierra el 23; hoy 27-jul → ya cerró este mes y sigue impago
  const bbva: Card = { ...card, id: "b1", nickname: "BBVA", closingDay: 23, closingBusinessAdjust: false };
  const hoy27 = parseYmd("2026-07-27");
  it("aparece en el mes en curso (julio), no recién en el siguiente", () => {
    const purchases = [p({ cardId: "b1", installments: 3, paidInstallments: 0, amount: 30_000 })];
    const jul = cardStatement(bbva, purchases, [], rates, 2026, 6, hoy27); // julio
    expect(jul.closing && ymd(jul.closing)).toBe("2026-07-23");
    expect(jul.items).toHaveLength(1);
    expect(jul.total).toBe(10_000);
  });
});

describe("currentStatement", () => {
  it("es una cuota por compra pendiente + fijos (offset 0)", () => {
    const purchases = [
      p({ id: "a", installments: 3, paidInstallments: 2 }), // cuota 3
      p({ id: "b", installments: 6, paidInstallments: 6 }), // saldada → excluida
    ];
    const cs = currentStatement(card, purchases, [], rates, hoy);
    expect(cs.items.map((i) => i.purchaseId)).toEqual(["a"]);
    expect(cs.total).toBe(10_000);
  });
});

describe("generalStatement", () => {
  it("suma las tarjetas con algo a pagar en el mes", () => {
    const card2: Card = { ...card, id: "c2", nickname: "Otra" };
    const purchases = [
      p({ id: "a", cardId: "c1", amount: 30_000, installments: 3, paidInstallments: 0 }),
      p({ id: "b", cardId: "c2", amount: 60_000, installments: 3, paidInstallments: 0 }),
    ];
    const g = generalStatement([card, card2], purchases, [], rates, 2026, 6, hoy);
    expect(g.perCard).toHaveLength(2);
    expect(g.total).toBe(10_000 + 20_000);
  });
});

describe("amountDueThisMonth", () => {
  it("suma tarjetas + deudas + fijos sueltos, sin doblar los fijos con tarjeta", () => {
    const purchases = [p({ id: "a", installments: 3, paidInstallments: 0, amount: 30_000 })]; // cuota 10.000
    const fixed: FixedExpense[] = [
      { id: "cf", cardId: "c1", name: "Con tarjeta", amount: 4_000, currency: "ARS", category: "Ocio", active: true, occupiesLimit: true },
      { id: "sf", cardId: null, name: "Obra social", amount: 7_000, currency: "ARS", category: "Salud", active: true, occupiesLimit: true },
    ];
    const debts: Debt[] = [
      { id: "d", creditor: "Primo", note: "", amount: 20_000, currency: "ARS", installments: 2, paidInstallments: 0 }, // cuota 10.000
    ];
    const r = amountDueThisMonth([card], purchases, fixed, debts, rates, hoy);
    expect(r.cards).toBe(10_000 + 4_000); // cuota de la compra + fijo cargado a la tarjeta
    expect(r.debts).toBe(10_000);
    expect(r.fixed).toBe(7_000); // solo el gasto fijo suelto
    expect(r.total).toBe(31_000);
  });
});
