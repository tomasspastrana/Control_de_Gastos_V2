import { describe, expect, it } from "vitest";
import {
  type ClosingRule,
  closingInMonth,
  closingSpan,
  currentDueClosing,
  forwardClosingInMonth,
  deriveWeekdayCycle,
  dueDate,
  lastClosingOnOrBefore,
  nextClosing,
  parseYmd,
  paymentAlert,
  purchaseStatement,
  ruleFromCard,
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

describe("weekday_cycle (BBVA Francés) — un cierre por mes", () => {
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-04-23", "2026-05-21") };
  it("predice 21-may → 18-jun → 16-jul (3er jueves), todos jueves", () => {
    const cs = upcomingClosings(rule, parseYmd("2026-05-01"), 3).map(ymd);
    expect(cs).toEqual(["2026-05-21", "2026-06-18", "2026-07-16"]);
    upcomingClosings(rule, parseYmd("2026-05-01"), 3).forEach((d) => expect(isThursday(d)).toBe(true));
  });
});

describe("weekday_cycle antes del ancla (camina hacia atrás)", () => {
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-04-23", "2026-05-21") };
  it("nextClosing con fecha anterior al ancla no se queda en el ancla", () => {
    expect(ymd(nextClosing(rule, parseYmd("2026-01-01")))).toBe("2026-01-15");
  });
  it("una compra vieja reparte las cuotas mes a mes (una por mes, sin amontonar)", () => {
    const cs = upcomingClosings(rule, parseYmd("2025-12-24"), 6).map(ymd);
    expect(cs).toEqual(["2026-01-15", "2026-02-19", "2026-03-19", "2026-04-16", "2026-05-21", "2026-06-18"]);
  });
});

describe("weekday_cycle (Banco Patagonia) — cierra todos los meses", () => {
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-02-26", "2026-03-26") };
  it("predice 26-mar → 23-abr → 28-may (4º jueves)", () => {
    const cs = upcomingClosings(rule, parseYmd("2026-03-01"), 3).map(ymd);
    expect(cs).toEqual(["2026-03-26", "2026-04-23", "2026-05-28"]);
  });
  it("junio también cierra (25-jun), no se saltea ningún mes", () => {
    expect(ymd(nextClosing(rule, parseYmd("2026-06-01")))).toBe("2026-06-25");
  });
});

describe("weekday_cycle mensual: clamp al último jueves en meses cortos", () => {
  // ancla 30-jul-2026 = 5º (último) jueves de julio
  const rule: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-06-25", "2026-07-30") };
  it("cae en el último jueves cuando el mes tiene menos ocurrencias", () => {
    expect(ymd(closingInMonth(rule, 2026, 1)!)).toBe("2026-02-26"); // feb: sólo 4 jueves → último
    expect(ymd(closingInMonth(rule, 2026, 7)!)).toBe("2026-08-27"); // agosto
    expect(ymd(closingInMonth(rule, 2026, 8)!)).toBe("2026-09-24"); // septiembre
  });
});

describe("weekday_from (Cencopay) — primer jueves a partir del día 6", () => {
  // resúmenes reales 2026: 07/05, 11/06, 08/07 (el 9/7 es feriado → hábil anterior), 06/08, 10/09
  const cenco: ClosingRule = { type: "weekday_from", weekday: 4, fromDay: 6, businessAdjust: true };
  it("reproduce los cinco cierres reales, incluido el corrimiento por feriado", () => {
    const cs = upcomingClosings(cenco, parseYmd("2026-05-01"), 5).map(ymd);
    expect(cs).toEqual(["2026-05-07", "2026-06-11", "2026-07-08", "2026-08-06", "2026-09-10"]);
  });
  it("alterna 1er/2do jueves según el mes (donde weekday_cycle fallaría)", () => {
    expect(ymd(closingInMonth(cenco, 2026, 11)!)).toBe("2026-12-10");
    expect(ymd(closingInMonth(cenco, 2027, 0)!)).toBe("2027-01-07");
  });
  it("vence a los 8 días: siempre el viernes de la semana siguiente", () => {
    expect(ymd(dueDate(parseYmd("2026-05-07"), 8))).toBe("2026-05-15");
    expect(ymd(dueDate(parseYmd("2026-06-11"), 8))).toBe("2026-06-19");
    expect(ymd(dueDate(parseYmd("2026-08-06"), 8))).toBe("2026-08-14");
    expect(ymd(dueDate(parseYmd("2026-09-10"), 8))).toBe("2026-09-18");
  });
  it("lastClosingOnOrBefore camina hacia atrás", () => {
    expect(ymd(lastClosingOnOrBefore(cenco, parseYmd("2026-09-01"))!)).toBe("2026-08-06");
    expect(ymd(lastClosingOnOrBefore(cenco, parseYmd("2026-09-13"))!)).toBe("2026-09-10");
  });
  it("no se pasa del mes cuando el día de inicio está al final (clamp)", () => {
    const late: ClosingRule = { type: "weekday_from", weekday: 4, fromDay: 28, businessAdjust: false };
    // feb-2027: 28 es domingo → el jueves siguiente sería el 4-mar → se retrocede al 25-feb
    expect(ymd(closingInMonth(late, 2027, 1)!)).toBe("2027-02-25");
  });
  it("ruleFromCard arma la regla desde las columnas (y no sin el día de semana)", () => {
    const cols = { closingRuleType: "weekday_from", closingDay: 6, closingBusinessAdjust: true, closingWeekday: 4 };
    expect(ruleFromCard(cols)).toEqual(cenco);
    expect(ruleFromCard({ ...cols, closingWeekday: null })).toBeNull();
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

describe("closingSpan", () => {
  it("cuenta resúmenes de distancia, con signo", () => {
    expect(closingSpan(parseYmd("2026-08-23"), parseYmd("2026-08-23"))).toBe(0);
    expect(closingSpan(parseYmd("2026-08-23"), parseYmd("2026-09-23"))).toBe(1);
    expect(closingSpan(parseYmd("2026-09-23"), parseYmd("2026-08-23"))).toBe(-1); // todavía no facturable
  });
  it("cruza el fin de año", () => {
    expect(closingSpan(parseYmd("2026-12-23"), parseYmd("2027-01-23"))).toBe(1);
    expect(closingSpan(parseYmd("2026-11-30"), parseYmd("2027-02-27"))).toBe(3);
  });
  it("solo mira el mes: el día exacto del cierre no cambia la cuenta", () => {
    // el ancla de weekday_cycle se mueve dentro del mes, pero sigue siendo un cierre por mes
    expect(closingSpan(parseYmd("2026-08-27"), parseYmd("2026-09-24"))).toBe(1);
  });
});

describe("closingInMonth", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("devuelve el cierre del mes pedido", () => {
    expect(ymd(closingInMonth(uala, 2026, 5)!)).toBe("2026-06-30"); // junio (month 5)
    expect(ymd(closingInMonth(uala, 2026, 1)!)).toBe("2026-02-27"); // febrero → hábil anterior
  });
  const patagonia: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-02-26", "2026-03-26") };
  it("weekday_cycle: cada mes tiene su cierre", () => {
    expect(ymd(closingInMonth(patagonia, 2026, 5)!)).toBe("2026-06-25"); // junio
    expect(ymd(closingInMonth(patagonia, 2026, 6)!)).toBe("2026-07-23"); // julio
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
  it("con start explícito ancla el offset 0 en ese cierre (aunque sea pasado)", () => {
    const start = parseYmd("2026-06-30"); // resumen que vence ahora
    expect(forwardClosingInMonth(uala, 2026, 5, hoy, start)?.offset).toBe(0); // junio
    expect(forwardClosingInMonth(uala, 2026, 6, hoy, start)?.offset).toBe(1); // julio
    expect(forwardClosingInMonth(uala, 2026, 3, hoy, start)).toBeNull(); // abril: antes del start
  });
  const patagonia: ClosingRule = { type: "weekday_cycle", ...deriveWeekdayCycle("2026-05-28", "2026-07-02") };
  it("weekday_cycle: cierra todos los meses (agosto ya no queda vacío)", () => {
    // ancla 02-jul (1er jueves); hoy 08-jul → el cierre de julio (02-jul) ya pasó
    expect(forwardClosingInMonth(patagonia, 2026, 6, hoy)).toBeNull(); // julio ya cerró
    const ago = forwardClosingInMonth(patagonia, 2026, 7, hoy); // agosto SÍ cierra
    expect(ago && ymd(ago.closing)).toBe("2026-08-06");
    expect(ago?.offset).toBe(0);
  });
});

describe("currentDueClosing", () => {
  const uala: ClosingRule = { type: "fixed_day", day: 30, businessAdjust: true };
  it("resumen ya cerrado y sin pagar → ese cierre (no salta al próximo)", () => {
    // hoy 08-jul: el 30-jun cerró y no se pagó → resumen que vence ahora
    expect(ymd(currentDueClosing(uala, parseYmd("2026-07-08"), null))).toBe("2026-06-30");
  });
  it("resumen pagado (pago on/after el cierre) → próximo cierre", () => {
    expect(ymd(currentDueClosing(uala, parseYmd("2026-07-08"), "2026-07-05"))).toBe("2026-07-30");
  });
  it("cierre ya ocurrido antes de hoy dentro del mes en curso y sin pagar → ese cierre (bug BBVA)", () => {
    const bbva: ClosingRule = { type: "fixed_day", day: 23, businessAdjust: false };
    expect(ymd(currentDueClosing(bbva, parseYmd("2026-07-27"), null))).toBe("2026-07-23");
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
