import { describe, expect, it } from "vitest";
import {
  type ClosingRule,
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
    const a = paymentAlert(uala, 8, true, parseYmd("2026-07-06"));
    expect(a?.level).toBe("due-soon");
    expect(a?.days).toBe(2);
  });
  it("overdue: venció y hay deuda", () => {
    const a = paymentAlert(uala, 8, true, parseYmd("2026-07-10")); // vence 08-jul
    expect(a?.level).toBe("overdue");
    expect(a?.days).toBeLessThan(0);
  });
  it("sin deuda no marca overdue", () => {
    expect(paymentAlert(uala, 8, false, parseYmd("2026-07-10"))).toBeNull();
  });
  it("lejos del vencimiento no marca nada", () => {
    expect(paymentAlert(uala, 8, true, parseYmd("2026-07-01"))).toBeNull(); // vence 08-jul, 7 días
  });
  it("sin dueDays no marca nada", () => {
    expect(paymentAlert(uala, null, true, parseYmd("2026-07-10"))).toBeNull();
  });
});
