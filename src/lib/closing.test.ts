import { describe, expect, it } from "vitest";
import {
  type ClosingRule,
  closingInMonth,
  forwardClosingInMonth,
  deriveWeekdayCycle,
  dueDate,
  lastClosingOnOrBefore,
  nextClosing,
  parseYmd,
  paymentAlert,
  purchaseStatement,
  upcomingClosings,
  ymd,
} from "./closing";

const isThursday = (d: Date) => d.getDay() === 4;

describe("fixed_day (Ualá: día 30 con ajuste a hábil anterior)", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("febrero no tiene 30 → último hábil (27-feb-2026, viernes)", () => {
    expect(ymd(nextClosing(uala, parseYmd("2026-02-01")))).toBe("2026-02-27");
  });
  it("mayo: el 30 es sábado → se mueve al 29 (viernes)", () => {
    expect(ymd(nextClosing(uala, parseYmd("2026-05-01")))).toBe("2026-05-29");
  });
  it("marzo/junio: el 30 es hábil → queda el 30", () => {
    expect(ymd(nextClosing(uala, parseYmd("2026-03-01")))).toBe("2026-03-30");
    expect(ymd(nextClosing(uala, parseYmd("2026-06-01")))).toBe("2026-06-30");
  });
});

describe("fixed_day (Sucrédito: día 23 sin ajuste)", () => {
  const suc: ClosingRule = { type: "fixed_day", day: 23, businessAdjust: false };
  it("cae el 23 aunque sea sábado", () => {
    expect(ymd(nextClosing(suc, parseYmd("2026-05-01")))).toBe("2026-05-23");
    expect(ymd(nextClosing(suc, parseYmd("2026-06-01")))).toBe("2026-06-23");
  });
});

describe("weekday_cycle (BBVA Francés)", () => {
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-04-23", "2026-05-21") };
  it("predice 21-may → 25-jun → 23-jul, todos jueves", () => {
    const cs = upcomingClosings(rule, parseYmd("2026-05-01"), 3).map(ymd);
    expect(cs).toEqual(["2026-05-21", "2026-06-25", "2026-07-23"]);
    upcomingClosings(rule, parseYmd("2026-05-01"), 3).forEach((d) => expect(isThursday(d)).toBe(true));
  });
});

describe("weekday_cycle antes del ancla (camina hacia atrás)", () => {
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-04-23", "2026-05-21") };
  it("nextClosing con fecha anterior al ancla no se queda en el ancla", () => {
    expect(ymd(nextClosing(rule, parseYmd("2026-01-01")))).toBe("2026-01-15");
  });
  it("una compra vieja reparte las cuotas mes a mes (no se amontonan en el ancla)", () => {
    const cs = upcomingClosings(rule, parseYmd("2025-12-24"), 6).map(ymd);
    expect(cs).toEqual(["2026-01-15", "2026-02-19", "2026-03-19", "2026-04-23", "2026-05-21", "2026-06-25"]);
  });
});

describe("weekday_cycle (Banco Patagonia)", () => {
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-02-26", "2026-03-26") };
  it("predice 26-mar → 30-abr → 28-may", () => {
    const cs = upcomingClosings(rule, parseYmd("2026-03-01"), 3).map(ymd);
    expect(cs).toEqual(["2026-03-26", "2026-04-30", "2026-05-28"]);
  });
  it("desde junio salta a 02-jul (ciclo +35)", () => {
    expect(ymd(nextClosing(rule, parseYmd("2026-06-01")))).toBe("2026-07-02");
  });
});

describe("dueDate", () => {
  it("Patagonia: cierre + 11 corridos = lunes hábil", () => {
    expect(ymd(dueDate(parseYmd("2026-05-28"), 11))).toBe("2026-06-08");
  });
  it("Ualá: cierre + 8 corridos, movido a hábil siguiente", () => {
    expect(ymd(dueDate(parseYmd("2026-05-29"), 8))).toBe("2026-06-08"); // 06-jun sáb → 08-jun lun
    expect(ymd(dueDate(parseYmd("2026-01-30"), 8))).toBe("2026-02-09"); // 07-feb sáb → 09-feb lun
  });
});

describe("purchaseStatement", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("compra ANTES del cierre → cae en el resumen de ese ciclo", () => {
    const s = purchaseStatement(uala, parseYmd("2026-06-10"), 8);
    expect(ymd(s.closing)).toBe("2026-06-30");
    expect(ymd(s.due!)).toBe("2026-07-08"); // 30-jun + 8 = 08-jul (hábil)
  });
  it("compra DESPUÉS del cierre → pasa al próximo resumen", () => {
    // 30-jun ya pasó → primer cierre siguiente = 30-jul
    const s = purchaseStatement(uala, parseYmd("2026-07-01"), 8);
    expect(ymd(s.closing)).toBe("2026-07-30");
  });
  it("sin dueDays devuelve due null", () => {
    expect(purchaseStatement(uala, parseYmd("2026-06-10"), null).due).toBeNull();
  });
});

describe("closingInMonth", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("devuelve el cierre del mes pedido", () => {
    expect(ymd(closingInMonth(uala, 2026, 5)!)).toBe("2026-06-30"); // junio (month 5)
    expect(ymd(closingInMonth(uala, 2026, 1)!)).toBe("2026-02-27"); // febrero → hábil anterior
  });
  const patagonia: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-02-26", "2026-03-26") };
  it("weekday_cycle: mes sin cierre devuelve null", () => {
    // ciclo salta de 28-may a 02-jul → junio no tiene cierre
    expect(closingInMonth(patagonia, 2026, 5)).toBeNull();
    expect(ymd(closingInMonth(patagonia, 2026, 6)!)).toBe("2026-07-02");
  });
});

describe("forwardClosingInMonth (ancla a 'ahora')", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  const hoy = parseYmd("2026-07-08");
  it("mes actual → offset 0", () => {
    const r = forwardClosingInMonth(uala, 2026, 6, hoy); // julio
    expect(r && ymd(r.closing)).toBe("2026-07-30");
    expect(r?.offset).toBe(0);
  });
  it("mes siguiente → offset 1", () => {
    const r = forwardClosingInMonth(uala, 2026, 7, hoy); // agosto
    expect(r?.offset).toBe(1);
  });
  it("mes pasado → null", () => {
    expect(forwardClosingInMonth(uala, 2026, 5, hoy)).toBeNull(); // junio
  });
  const patagonia: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-05-28", "2026-07-02") };
  it("weekday_cycle: mes que el ciclo saltea → null", () => {
    // 02-jul ya pasó; próximo 30-jul (offset 0 en julio); luego salta a septiembre → agosto null
    expect(forwardClosingInMonth(patagonia, 2026, 6, hoy)?.offset).toBe(0); // julio 30
    expect(forwardClosingInMonth(patagonia, 2026, 7, hoy)).toBeNull(); // agosto: no cierra
  });
});

describe("lastClosingOnOrBefore", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("antes del cierre del mes → toma el cierre del mes anterior", () => {
    expect(ymd(lastClosingOnOrBefore(uala, parseYmd("2026-06-15"))!)).toBe("2026-05-29");
  });
  it("después del cierre del mes → toma el de este mes", () => {
    expect(ymd(lastClosingOnOrBefore(uala, parseYmd("2026-07-05"))!)).toBe("2026-06-30");
  });
});

describe("paymentAlert", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("due-soon: faltan pocos días para el vencimiento", () => {
    // cierre 30-jun, vence 08-jul; hoy 06-jul → faltan 2 días
    const a = paymentAlert(uala, 8, true, null, parseYmd("2026-07-06"));
    expect(a?.level).toBe("due-soon");
    expect(a?.days).toBe(2);
  });
  it("overdue: venció y hay deuda", () => {
    const a = paymentAlert(uala, 8, true, null, parseYmd("2026-07-10")); // vence 08-jul
    expect(a?.level).toBe("overdue");
    expect(a?.days).toBeLessThan(0);
  });
  it("sin deuda no marca nada", () => {
    expect(paymentAlert(uala, 8, false, null, parseYmd("2026-07-10"))).toBeNull();
  });
  it("lejos del vencimiento no marca nada", () => {
    expect(paymentAlert(uala, 8, true, null, parseYmd("2026-07-01"))).toBeNull(); // vence 08-jul, 7 días
  });
  it("sin dueDays no marca nada", () => {
    expect(paymentAlert(uala, null, true, null, parseYmd("2026-07-10"))).toBeNull();
  });
  it("pagada: pago on/after el cierre del resumen → sin aviso aunque haya vencido", () => {
    // cierre del resumen actual = 30-jun; pagó el 01-jul → resumen saldado
    expect(paymentAlert(uala, 8, true, "2026-07-01", parseYmd("2026-07-10"))).toBeNull();
  });
  it("pago viejo (antes del cierre actual) no cuenta como pagado", () => {
    // pago 20-jun es anterior al cierre 30-jun → sigue vencida
    const a = paymentAlert(uala, 8, true, "2026-06-20", parseYmd("2026-07-10"));
    expect(a?.level).toBe("overdue");
  });
});
