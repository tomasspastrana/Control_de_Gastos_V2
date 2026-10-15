import { describe, expect, it } from "vitest";
import {
  amountDueThisMonth,
  buildPaidSnapshot,
  cardSince,
  cardStatement,
  currentStatement,
  generalStatement,
  openStatement,
  purchaseNextClosing,
  snapshotOwnTotal,
  statementPayState,
} from "./statements";
import { parseYmd, ruleFromCard, ymd } from "./closing";
import type { Card, Debt, FixedExpense, Purchase, Rates, StatementSnapshot } from "./types";

const rates: Rates = { ARS: 1, USD: 1000, EUR: 1200 };

// Ualá-style: fixed day 30, business-adjust, pays 8 days after closing
const card: Card = {
  id: "c1", nickname: "Ualá", holder: "X", brand: "visa", last4: "0001",
  limit: 1_000_000, limitCurrency: "ARS", expiry: "01/30", theme: "violet",
  closingRuleType: "fixed_day", closingDay: 30, closingBusinessAdjust: true, dueDays: 8,
};

const p = (over: Partial<Purchase>): Purchase => ({
  id: "p", cardId: "c1", merchant: "m", amount: 30_000, currency: "ARS",
  installments: 3, paidInstallments: 0, category: "Otros", date: "2026-06-10",
  sharedWith: null, myPct: 100, ...over,
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

describe("una compra posterior al cierre entra recién en el resumen siguiente", () => {
  // SUCREDITO-style: cierra el 23, vence 9 días después. Hoy 24-ago: el resumen cerró ayer.
  const suc: Card = { ...card, id: "s1", nickname: "Sucredito", closingDay: 23, closingBusinessAdjust: false, dueDays: 9 };
  const hoy24 = parseYmd("2026-08-24");
  // comprada el 13-ago (antes del cierre) → ya facturada
  const mueble = p({ id: "mueble", cardId: "s1", merchant: "Mueble Valen", date: "2026-08-13", amount: 600_000, installments: 6, paidInstallments: 0 });
  // comprada el 24-ago (un día DESPUÉS del cierre) → todavía no facturada
  const soporte = p({ id: "soporte", cardId: "s1", merchant: "Soporte Compu", date: "2026-08-24", amount: 20_000, installments: 1, paidInstallments: 0 });
  const mantenimiento: FixedExpense[] = [
    { id: "mant", cardId: "s1", name: "Mantenimiento", amount: 12_000, currency: "ARS", category: "Servicios", active: true, occupiesLimit: true },
  ];

  it("no se suma al resumen que ya cerró", () => {
    const ago = cardStatement(suc, [mueble, soporte], mantenimiento, rates, 2026, 7, hoy24);
    expect(ymd(ago.closing!)).toBe("2026-08-23");
    expect(ago.items.map((i) => i.label)).toEqual(["Mueble Valen", "Mantenimiento"]);
    expect(ago.items[0].sub).toBe("cuota 1/6");
    expect(ago.total).toBe(100_000 + 12_000); // sin los 20.000 de Soporte Compu
  });

  it("aparece en el resumen siguiente, y las demás avanzan una cuota", () => {
    const sept = cardStatement(suc, [mueble, soporte], mantenimiento, rates, 2026, 8, hoy24);
    expect(ymd(sept.closing!)).toBe("2026-09-23");
    expect(sept.items.filter((i) => i.kind === "purchase").map((i) => `${i.label} ${i.sub}`)).toEqual([
      "Mueble Valen cuota 2/6",
      "Soporte Compu cuota 1/1",
    ]);
  });

  it("`currentStatement` y el total a pagar tampoco la incluyen", () => {
    const cs = currentStatement(suc, [mueble, soporte], mantenimiento, rates, hoy24);
    expect(cs.items.map((i) => i.purchaseId)).toEqual(["mueble", undefined]);
    expect(cs.total).toBe(112_000);

    const st = statementPayState(suc, [mueble, soporte], mantenimiento, rates, [], hoy24);
    expect(st.kind).toBe("payable");
    if (st.kind === "payable") expect(st.stmt.total).toBe(112_000);
  });

  it("la fecha solo empuja hacia adelante: una compra vieja sigue mandada por sus cuotas pagadas", () => {
    // cargada a mano en marzo con 2/6 pagadas → la próxima sigue siendo la 3, no la que diría el calendario
    const vieja = p({ id: "v", cardId: "s1", date: "2026-03-05", amount: 600_000, installments: 6, paidInstallments: 2 });
    const ago = cardStatement(suc, [vieja], [], rates, 2026, 7, hoy24);
    expect(ago.items[0].sub).toBe("cuota 3/6");
  });

  it("purchaseNextClosing: la diferida espera al cierre siguiente, la vieja usa el ancla", () => {
    const rule = ruleFromCard(suc)!;
    const anchor = parseYmd("2026-08-23");
    expect(ymd(purchaseNextClosing(rule, soporte, anchor))).toBe("2026-09-23");
    expect(ymd(purchaseNextClosing(rule, mueble, anchor))).toBe("2026-08-23");
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

describe("statementPayState (un resumen se paga una sola vez, y recién cuando cerró)", () => {
  const purchases = [p({ id: "a", installments: 3, paidInstallments: 1 })];
  const paidSnap = (over: Partial<StatementSnapshot> = {}): StatementSnapshot => ({
    id: "s", cardId: "c1", period: "2026-06-01", nickname: "Ualá",
    closingDate: "2026-06-30", dueDate: "2026-07-08", total: 10_000,
    items: [{ label: "m", sub: "cuota 2/3", amount: 10_000, kind: "purchase", purchaseId: "a" }],
    paidAt: "2026-07-02", ...over,
  });

  it("sin ciclo de cierre no hay nada que pagar", () => {
    const noRule: Card = { ...card, closingRuleType: null, closingDay: null };
    expect(statementPayState(noRule, purchases, [], rates, [], hoy).kind).toBe("no-rule");
  });

  it("el último resumen cerrado y sin snapshot es pagable", () => {
    const st = statementPayState(card, purchases, [], rates, [], hoy);
    expect(st.kind).toBe("payable");
    if (st.kind !== "payable") return;
    expect(ymd(st.closing)).toBe("2026-06-30"); // el 30-jun cerró; hoy es 08-jul
    expect(st.period).toBe("2026-06-01");
    expect(st.stmt.items[0].sub).toBe("cuota 2/3");
  });

  it("con el snapshot de ese período guardado ya está pagado: no se puede pagar de nuevo", () => {
    const st = statementPayState(card, purchases, [], rates, [paidSnap()], hoy);
    expect(st.kind).toBe("paid");
    if (st.kind !== "paid") return;
    expect(ymd(st.nextClosing)).toBe("2026-07-30"); // el próximo se habilita al cerrar julio
  });

  it("el snapshot de otra tarjeta u otro período no bloquea el pago", () => {
    expect(statementPayState(card, purchases, [], rates, [paidSnap({ cardId: "otra" })], hoy).kind).toBe("payable");
    expect(statementPayState(card, purchases, [], rates, [paidSnap({ period: "2026-05-01" })], hoy).kind).toBe("payable");
  });

  it("no depende de lastPaymentAt (los pagos viejos no dejaron snapshot)", () => {
    const stamped: Card = { ...card, lastPaymentAt: "2026-07-02" };
    expect(statementPayState(stamped, purchases, [], rates, [], hoy).kind).toBe("payable");
  });

  it("tarjeta dada de alta después del último cierre, sin compras anteriores: todavía no tiene resumen que pagar", () => {
    const nueva: Card = { ...card, createdAt: "2026-07-05" }; // el 30-jun cerró antes del alta
    const posteriores = [p({ id: "a", date: "2026-07-03" })]; // comprada después del cierre
    const st = statementPayState(nueva, posteriores, [], rates, [], hoy);
    expect(st.kind).toBe("not-closed");
    if (st.kind !== "not-closed") return;
    expect(ymd(st.nextClosing)).toBe("2026-07-30");
    // alta el mismo día del cierre → ese resumen sí es pagable
    expect(statementPayState({ ...card, createdAt: "2026-06-30" }, posteriores, [], rates, [], hoy).kind).toBe("payable");
  });

  it("tarjeta dada de alta después del último cierre PERO con compras anteriores a él: ese resumen es nuestro", () => {
    const nueva: Card = { ...card, createdAt: "2026-07-05" };
    const st = statementPayState(nueva, purchases, [], rates, [], hoy); // compra del 10-jun → cerró el 30-jun
    expect(st.kind).toBe("payable");
    if (st.kind !== "payable") return;
    expect(ymd(st.closing)).toBe("2026-06-30");
    expect(st.stmt.items).toHaveLength(1);
    // una compra anterior pero ya saldada no cuenta
    const saldada = [p({ id: "a", installments: 3, paidInstallments: 3 })];
    expect(statementPayState(nueva, saldada, [], rates, [], hoy).kind).toBe("not-closed");
  });
});

describe("cardSince — desde cuándo los cierres son de la tarjeta", () => {
  it("es el alta, salvo que haya compras pendientes anteriores", () => {
    const c = { id: "c1", createdAt: "2026-09-13" };
    expect(cardSince(c, [])).toBe("2026-09-13");
    expect(cardSince(c, [p({ date: "2026-08-13" })])).toBe("2026-08-13");
    expect(cardSince(c, [p({ date: "2026-08-13", cardId: "otra" })])).toBe("2026-09-13"); // de otra tarjeta
    expect(cardSince(c, [p({ date: "2026-08-13", installments: 1, paidInstallments: 1 })])).toBe("2026-09-13"); // saldada
    expect(cardSince(c, [], ["2026-08-01"])).toBe("2026-08-01"); // la línea del formulario
    expect(cardSince({ id: "c1", createdAt: null }, [p({ date: "2026-08-13" })])).toBeNull();
  });
});

describe("Cencopay dada de alta el 13/09 con compras del 13/08 (cerró el 10/09, vence el 18/09)", () => {
  // cierra el 1er jueves desde el 6 → factura casi todo el mes anterior: el cierre del 10/09 es el
  // resumen de AGOSTO (mes 7) y el del 08/10 el de septiembre (mes 8)
  const cenco: Card = {
    ...card, id: "cenco", nickname: "Noe Cenco",
    closingRuleType: "weekday_from", closingDay: 6, closingWeekday: 4, closingBusinessAdjust: true, dueDays: 8,
    createdAt: "2026-09-13",
  };
  const hoy17 = parseYmd("2026-09-17");
  const compras = [
    p({ id: "jumbo", cardId: "cenco", date: "2026-08-13", installments: 12, paidInstallments: 3 }),
    p({ id: "sporting", cardId: "cenco", date: "2026-08-13", installments: 9, paidInstallments: 0 }),
    p({ id: "comedor", cardId: "cenco", date: "2026-09-13", installments: 24, paidInstallments: 0 }), // después del cierre
  ];

  it("el resumen que vence ahora es el que cerró el 10/09, no el del 08/10", () => {
    const st = currentStatement(cenco, compras, [], rates, hoy17);
    expect(ymd(st.closing!)).toBe("2026-09-10");
    expect(ymd(st.due!)).toBe("2026-09-18");
    expect(st.items.map((i) => `${i.label} ${i.sub}`)).toEqual(["m cuota 4/12", "m cuota 1/9"]);
  });

  it("las compras de agosto van al resumen de agosto y la del 13/09 recién al de septiembre", () => {
    const ago = cardStatement(cenco, compras, [], rates, 2026, 7, hoy17); // agosto → cierra 10/09
    expect(ymd(ago.closing!)).toBe("2026-09-10");
    expect(ago.items.map((i) => i.purchaseId)).toEqual(["jumbo", "sporting"]);
    const sep = cardStatement(cenco, compras, [], rates, 2026, 8, hoy17); // septiembre → cierra 08/10
    expect(ymd(sep.closing!)).toBe("2026-10-08");
    expect(sep.items.map((i) => `${i.purchaseId} ${i.sub}`)).toEqual(["jumbo cuota 5/12", "sporting cuota 2/9", "comedor cuota 1/24"]);
  });

  it("se puede pagar el resumen de agosto, archivado en 2026-08 (no en 2026-09)", () => {
    const st = statementPayState(cenco, compras, [], rates, [], hoy17);
    expect(st.kind).toBe("payable");
    if (st.kind !== "payable") return;
    expect(ymd(st.closing)).toBe("2026-09-10");
    expect(st.period).toBe("2026-08-01");
  });

  it("la segunda Cencopay (a partir del 20) sólo con una compra del 13/09 sigue sin resumen pendiente", () => {
    const cenco2: Card = { ...cenco, id: "cenco2", closingDay: 20, dueDays: 13 };
    const solo = [p({ id: "easy", cardId: "cenco2", date: "2026-09-13", installments: 24 })];
    expect(statementPayState(cenco2, solo, [], rates, [], hoy17).kind).toBe("not-closed");
    expect(ymd(currentStatement(cenco2, solo, [], rates, hoy17).closing!)).toBe("2026-09-24");
  });
});

describe("buildPaidSnapshot", () => {
  it("una tarjeta que cierra tarde archiva en el mes del cierre, no en el que se paga", () => {
    const closing = parseYmd("2026-06-30");
    const stmt = cardStatement(card, [p({ id: "a", installments: 3, paidInstallments: 1 })], [], rates, 2026, 5, hoy);
    const snap = buildPaidSnapshot(card, stmt, closing, "2026-07-08"); // pagado en julio
    expect(snap.period).toBe("2026-06-01");
    expect(snap.closingDate).toBe("2026-06-30");
    expect(snap.paidAt).toBe("2026-07-08");
    // el purchaseId viaja en el jsonb para poder deshacer el pago exacto
    expect(snap.items[0].purchaseId).toBe("a");
    expect(snap.total).toBe(stmt.total);
  });

  it("una tarjeta que cierra temprano archiva en el mes anterior al del cierre", () => {
    const cenco: Card = {
      ...card, id: "cenco", nickname: "Noe Cenco",
      closingRuleType: "weekday_from", closingDay: 6, closingWeekday: 4, closingBusinessAdjust: true, dueDays: 8,
    };
    const closing = parseYmd("2026-09-10");
    const stmt = cardStatement(cenco, [p({ id: "a", cardId: "cenco", installments: 3, paidInstallments: 1 })], [], rates, 2026, 7, parseYmd("2026-09-17"));
    const snap = buildPaidSnapshot(cenco, stmt, closing, "2026-09-19");
    expect(snap.period).toBe("2026-08-01"); // el resumen de agosto, aunque cerró en septiembre
    expect(snap.closingDate).toBe("2026-09-10");
  });
});

describe("openStatement — el resumen en curso (tentativo)", () => {
  const cenco: Card = {
    ...card, id: "cenco", nickname: "Noe Cenco",
    closingRuleType: "weekday_from", closingDay: 6, closingWeekday: 4, closingBusinessAdjust: true, dueDays: 8,
    createdAt: "2026-08-01",
  };
  const compras = [p({ id: "jumbo", cardId: "cenco", date: "2026-07-20", installments: 12, paidInstallments: 3 })];
  const hoy = parseYmd("2026-10-05"); // el 10/09 ya cerró, el 08/10 todavía no

  it("es el primer cierre futuro, con su vencimiento", () => {
    const st = openStatement(cenco, compras, [], rates, hoy)!;
    expect(ymd(st.closing!)).toBe("2026-10-08");
    expect(ymd(st.due!)).toBe("2026-10-16");
  });

  it("con el resumen anterior impago cobra la cuota siguiente a la que está por pagarse", () => {
    // el del 10/09 (cuota 4) sigue impago → el tentativo es la cuota 5
    expect(openStatement(cenco, compras, [], rates, hoy)!.items[0].sub).toBe("cuota 5/12");
  });

  it("con el resumen anterior ya pagado cobra la cuota siguiente a la pagada", () => {
    // pagar avanzó paidInstallments a 4 → el tentativo es la cuota 5, mismo cierre
    const pagada = [p({ id: "jumbo", cardId: "cenco", date: "2026-07-20", installments: 12, paidInstallments: 4 })];
    const st = openStatement({ ...cenco, lastPaymentAt: "2026-09-19" }, pagada, [], rates, hoy)!;
    expect(ymd(st.closing!)).toBe("2026-10-08");
    expect(st.items[0].sub).toBe("cuota 5/12");
  });

  it("sin ciclo de cierre configurado devuelve null", () => {
    expect(openStatement({ ...cenco, closingRuleType: null, closingDay: null, closingWeekday: null }, compras, [], rates, hoy)).toBeNull();
  });
});

describe("compras compartidas en los resúmenes", () => {
  // cuota 10.000 mía + cuota 10.000 al 50 % con el suegro + cuota 10.000 prestada a la hermana
  const purchases = [
    p({ id: "a" }),
    p({ id: "b", sharedWith: "Suegro", myPct: 50 }),
    p({ id: "c", sharedWith: "Hermana", myPct: 0 }),
  ];
  const fx: FixedExpense = { id: "f", cardId: "c1", name: "Mant.", amount: 2_000, currency: "ARS", category: "Otros", active: true, occupiesLimit: false };

  it("cada línea lleva su parte propia; el total del resumen es el del banco", () => {
    const jun = cardStatement(card, purchases, [fx], rates, 2026, 5, hoy);
    expect(jun.total).toBe(32_000);
    expect(jun.ownTotal).toBe(10_000 + 5_000 + 0 + 2_000);
    const b = jun.items.find((i) => i.purchaseId === "b")!;
    expect(b).toMatchObject({ amount: 10_000, own: 5_000, sharedWith: "Suegro" });
    expect(jun.items.find((i) => i.purchaseId === "a")!.sharedWith).toBeUndefined();
    expect(generalStatement([card], purchases, [fx], rates, 2026, 5, hoy)).toMatchObject({ total: 32_000, ownTotal: 17_000 });
  });

  it("el snapshot congela la parte propia y la persona; los viejos sin `own` valen el total", () => {
    const stmt = cardStatement(card, purchases, [], rates, 2026, 5, hoy);
    const snap = buildPaidSnapshot(card, stmt, parseYmd("2026-06-30"), "2026-07-08");
    expect(snap.items.find((i) => i.purchaseId === "c")).toMatchObject({ own: 0, sharedWith: "Hermana" });
    expect(snapshotOwnTotal(snap)).toBe(15_000);
    const old: Pick<StatementSnapshot, "items" | "total"> = {
      total: 30_000,
      items: [{ label: "x", sub: "cuota 1/3", amount: 30_000, kind: "purchase" }],
    };
    expect(snapshotOwnTotal(old)).toBe(30_000);
    expect(snapshotOwnTotal({ total: 5, items: [] })).toBe(5);
  });

  it("amountDueThisMonth separa lo que cobra el banco de lo que debo", () => {
    const r = amountDueThisMonth([card], purchases, [], [], rates, hoy);
    expect(r.cards).toBe(30_000);
    expect(r.ownCards).toBe(15_000);
    expect(r.total).toBe(30_000);
    expect(r.ownTotal).toBe(15_000);
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
