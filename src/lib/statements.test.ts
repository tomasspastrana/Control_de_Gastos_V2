import { describe, expect, it } from "vitest";
import { cardStatement, currentStatement, generalStatement } from "./statements";
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

const hoy = parseYmd("2026-07-08"); // current close = 30-jul (offset 0)

describe("cardStatement (anclado a 'ahora' por offset)", () => {
  it("la próxima cuota impaga cae en el mes actual sin importar la fecha de compra", () => {
    // compra vieja (enero) con 2/3 pagadas → cuota 3 en el resumen actual (julio)
    const purchases = [p({ id: "a", merchant: "AF Jeans", date: "2026-01-15", installments: 3, paidInstallments: 2 })];
    const jul = cardStatement(card, purchases, [], rates, 2026, 6, hoy);
    expect(jul.items).toHaveLength(1);
    expect(jul.items[0].sub).toBe("cuota 3/3");
  });
  it("distribuye las cuotas restantes hacia adelante", () => {
    const purchases = [p({ id: "a", installments: 6, paidInstallments: 2 })]; // faltan 4
    expect(cardStatement(card, purchases, [], rates, 2026, 6, hoy).items[0].sub).toBe("cuota 3/6"); // julio
    expect(cardStatement(card, purchases, [], rates, 2026, 7, hoy).items[0].sub).toBe("cuota 4/6"); // agosto
  });
  it("compra saldada no aparece", () => {
    const jul = cardStatement(card, [p({ installments: 6, paidInstallments: 6 })], [], rates, 2026, 6, hoy);
    expect(jul.items).toHaveLength(0);
  });
  it("meses pasados quedan vacíos", () => {
    const jun = cardStatement(card, [p({ installments: 3, paidInstallments: 0 })], [], rates, 2026, 5, hoy);
    expect(jun.closing).toBeNull();
    expect(jun.items).toHaveLength(0);
  });
  it("incluye gastos fijos activos y calcula el vencimiento", () => {
    const fixed: FixedExpense[] = [
      { id: "f", cardId: "c1", name: "Netflix", amount: 5000, currency: "ARS", category: "Ocio", active: true, occupiesLimit: true },
      { id: "g", cardId: "c1", name: "Off", amount: 9999, currency: "ARS", category: "Ocio", active: false, occupiesLimit: true },
    ];
    const jul = cardStatement(card, [p({ installments: 3, paidInstallments: 2 })], fixed, rates, 2026, 6, hoy);
    expect(jul.total).toBe(10_000 + 5_000); // cuota 3 + Netflix; el pausado no cuenta
    expect(jul.due && jul.due.getMonth()).toBe(7); // 30-jul + 8 → agosto
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
