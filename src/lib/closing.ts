// Closing-date logic for credit cards (Argentina).
// Two rule shapes cover the banks we've seen:
//  - fixed_day: closes on a calendar day each month (optionally moved to the previous business day)
//  - weekday_cycle: closes always on the same weekday, alternating +28/+35 days from an anchor
//    (BBVA Francés, Banco Patagonia). Predictions are estimates; the user can re-anchor.
//
// Pure & side-effect free → unit-tested in closing.test.ts.

export type ClosingRule =
  | { type: "fixed_day"; day: number; businessAdjust: boolean }
  | { type: "weekday_cycle"; anchor: string; nextGap: 28 | 35 }; // anchor = "yyyy-mm-dd"

// ---- Argentina national holidays (maintainable; weekends are handled separately).
// Note: does NOT include ad-hoc "feriados puente" — closing dates are editable to correct drift.
export const AR_HOLIDAYS = new Set<string>([
  // 2026
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02", "2026-04-03",
  "2026-05-01", "2026-05-25", "2026-06-17", "2026-06-20", "2026-07-09", "2026-08-17",
  "2026-10-12", "2026-11-20", "2026-12-08", "2026-12-25",
  // 2027
  "2027-01-01", "2027-02-08", "2027-02-09", "2027-03-24", "2027-03-26", "2027-04-02",
  "2027-05-01", "2027-05-25", "2027-06-21", "2027-06-20", "2027-07-09", "2027-08-16",
  "2027-10-11", "2027-11-22", "2027-12-08", "2027-12-25",
]);

// ---- date helpers (work at local midnight to avoid TZ drift) ----
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}
export function isBusinessDay(d: Date): boolean {
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return false; // Sun / Sat
  return !AR_HOLIDAYS.has(ymd(d));
}
export function prevBusinessDay(d: Date): Date {
  let r = d;
  while (!isBusinessDay(r)) r = addDays(r, -1);
  return r;
}
export function nextBusinessDay(d: Date): Date {
  let r = d;
  while (!isBusinessDay(r)) r = addDays(r, 1);
  return r;
}

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function fixedClosingForMonth(year: number, month: number, day: number, businessAdjust: boolean): Date {
  const dom = Math.min(day, lastDayOfMonth(year, month));
  let d = new Date(year, month, dom);
  if (businessAdjust) d = prevBusinessDay(d);
  return d;
}

/** Next closing date on or after `from` (defaults to today). */
export function nextClosing(rule: ClosingRule, from: Date = new Date()): Date {
  const start = atMidnight(from);
  if (rule.type === "fixed_day") {
    for (let i = 0; i < 4; i++) {
      const base = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const c = fixedClosingForMonth(base.getFullYear(), base.getMonth(), rule.day, rule.businessAdjust);
      if (c >= start) return c;
    }
    // fallback (shouldn't happen)
    return fixedClosingForMonth(start.getFullYear(), start.getMonth() + 1, rule.day, rule.businessAdjust);
  }
  // weekday_cycle: walk forward from the anchor, or backward when `start` predates it
  let c = parseYmd(rule.anchor);
  let guard = 0;
  if (c < start) {
    let gap = rule.nextGap; // gap from c to the following closing
    while (c < start && guard++ < 600) {
      c = addDays(c, gap);
      gap = gap === 28 ? 35 : 28;
    }
  } else {
    // step backward while the previous closing is still >= start
    let gapBack = rule.nextGap === 28 ? 35 : 28; // gap between the previous closing and the anchor
    while (guard++ < 600) {
      const prev = addDays(c, -gapBack);
      if (prev < start) break;
      c = prev;
      gapBack = gapBack === 28 ? 35 : 28;
    }
  }
  return c;
}

/** The card's statement closing that falls within calendar (year, month), or null. */
export function closingInMonth(rule: ClosingRule, year: number, month: number): Date | null {
  const c = nextClosing(rule, new Date(year, month, 1));
  return c.getFullYear() === year && c.getMonth() === month ? c : null;
}

/** The next `n` closing dates starting at nextClosing(from). Iterates nextClosing so it
 *  stays correct for both rule shapes and for dates before a weekday_cycle anchor. */
export function upcomingClosings(rule: ClosingRule, from: Date = new Date(), n = 3): Date[] {
  const out: Date[] = [];
  let c = nextClosing(rule, from);
  for (let i = 0; i < n; i++) {
    out.push(c);
    c = nextClosing(rule, addDays(c, 1));
  }
  return out;
}

/** Payment due date = closing + dueDays (calendar), moved to next business day if needed. */
export function dueDate(closing: Date, dueDays: number): Date {
  return nextBusinessDay(addDays(closing, dueDays));
}

/** Statement a purchase first lands in: the first closing on/after its date, plus its due date. */
export function purchaseStatement(
  rule: ClosingRule,
  purchaseDate: Date,
  dueDays: number | null,
): { closing: Date; due: Date | null } {
  const closing = nextClosing(rule, purchaseDate);
  return { closing, due: dueDays != null ? dueDate(closing, dueDays) : null };
}

/**
 * Statement for a purchase's (0-indexed) installment: `index` cycles after the first.
 * Installment #1 (index 0) = first statement; installment #k = index k-1. Lets us show the
 * statement of the *current* pending cuota instead of always the first one.
 */
export function installmentStatement(
  rule: ClosingRule,
  purchaseDate: Date,
  index: number,
  dueDays: number | null,
): { closing: Date; due: Date | null } {
  const i = Math.max(0, index);
  const closings = upcomingClosings(rule, purchaseDate, i + 1);
  const closing = closings[Math.min(i, closings.length - 1)];
  return { closing, due: dueDays != null ? dueDate(closing, dueDays) : null };
}

/** Most recent closing on or before `from` (the statement currently awaiting payment). */
export function lastClosingOnOrBefore(rule: ClosingRule, from: Date = new Date()): Date | null {
  const start = atMidnight(from);
  if (rule.type === "fixed_day") {
    for (let i = 0; i < 4; i++) {
      const base = new Date(start.getFullYear(), start.getMonth() - i, 1);
      const c = fixedClosingForMonth(base.getFullYear(), base.getMonth(), rule.day, rule.businessAdjust);
      if (c <= start) return c;
    }
    return null;
  }
  // weekday_cycle
  let c = parseYmd(rule.anchor);
  let guard = 0;
  if (c <= start) {
    // walk forward keeping the last closing <= start
    let gap = rule.nextGap;
    while (guard++ < 600) {
      const next = addDays(c, gap);
      if (next > start) break;
      c = next;
      gap = gap === 28 ? 35 : 28;
    }
    return c;
  }
  // anchor is in the future: step backward until a closing is <= start
  let gapBack = rule.nextGap === 28 ? 35 : 28;
  while (c > start && guard++ < 600) {
    c = addDays(c, -gapBack);
    gapBack = gapBack === 28 ? 35 : 28;
  }
  return c <= start ? c : null;
}

/**
 * Payment alert for a card's current (last-closed) statement.
 * - `hasDebt`: there's something to pay (a fully paid-off card never alerts).
 * - `lastPaymentAt` (yyyy-mm-dd): if the card was paid on/after the current statement's
 *   closing, the statement is considered settled → no alert (fixes the "stuck overdue" bug).
 * Returns null when nothing to flag.
 */
export function paymentAlert(
  rule: ClosingRule,
  dueDays: number | null,
  hasDebt: boolean,
  lastPaymentAt: string | null = null,
  from: Date = new Date(),
  dueSoonDays = 5,
): { level: "due-soon" | "overdue"; due: Date; days: number } | null {
  if (dueDays == null || !hasDebt) return null;
  const closing = lastClosingOnOrBefore(rule, from);
  if (!closing) return null;
  // already paid this statement (payment on/after it closed)
  if (lastPaymentAt && parseYmd(lastPaymentAt) >= closing) return null;
  const due = dueDate(closing, dueDays);
  const days = daysUntil(due, from);
  if (days < 0) return { level: "overdue", due, days };
  if (days <= dueSoonDays) return { level: "due-soon", due, days };
  return null;
}

/** Whole days from `from` (today) until `date` (negative if past). */
export function daysUntil(date: Date, from: Date = new Date()): number {
  return Math.round((atMidnight(date).getTime() - atMidnight(from).getTime()) / 86_400_000);
}

/** Derive a weekday_cycle rule from two consecutive real closing dates (prev < last). */
export function deriveWeekdayCycle(prev: string, last: string): { anchor: string; nextGap: 28 | 35 } {
  const gap = daysUntil(parseYmd(last), parseYmd(prev)); // 28 or 35
  return { anchor: last, nextGap: gap === 35 ? 28 : 35 };
}

/** Build a ClosingRule from a card's flat columns (null if not configured). */
export function ruleFromCard(c: {
  closingRuleType?: string | null;
  closingDay?: number | null;
  closingBusinessAdjust?: boolean | null;
  closingAnchor?: string | null;
  closingNextGap?: number | null;
}): ClosingRule | null {
  if (c.closingRuleType === "fixed_day" && c.closingDay != null) {
    return { type: "fixed_day", day: c.closingDay, businessAdjust: !!c.closingBusinessAdjust };
  }
  if (c.closingRuleType === "weekday_cycle" && c.closingAnchor && (c.closingNextGap === 28 || c.closingNextGap === 35)) {
    return { type: "weekday_cycle", anchor: c.closingAnchor, nextGap: c.closingNextGap };
  }
  return null;
}

/** Short human label, e.g. "jue 23 jul". */
export function fmtClosing(d: Date): string {
  return d
    .toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "short" })
    .replace(/\./g, "")
    .replace(",", "");
}
