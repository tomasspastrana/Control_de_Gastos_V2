import { describe, expect, it } from "vitest";
import {
  type ClosingRule,
  deriveWeekdayCycle,
  dueDate,
  nextClosing,
  parseYmd,
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
