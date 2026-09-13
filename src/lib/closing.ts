// Closing-date logic for credit cards (Argentina).
// Three rule shapes cover the banks we've seen:
//  - fixed_day: closes on a calendar day each month (optionally moved to the previous business day)
//  - weekday_cycle: closes always on the same weekday, alternating +28/+35 days from an anchor
//    (BBVA Francés, Banco Patagonia). Predictions are estimates; the user can re-anchor.
//  - weekday_from: closes on the first `weekday` on/after day `fromDay` of each month, moved to the
//    previous business day on holidays (Cencopay: first Thursday from the 6th → 07/05, 11/06, 08/07…).
//
// Pure & side-effect free → unit-tested in closing.test.ts.

export type ClosingRule =
  | { type: "fixed_day"; day: number; businessAdjust: boolean }
  | { type: "weekday_cycle"; anchor: string; nextGap: 28 | 35 } // anchor = "yyyy-mm-dd"
  | { type: "weekday_from"; weekday: number; fromDay: number; businessAdjust: boolean }; // weekday 0=Sun..6=Sat

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

/** Date of the `ordinal`-th `weekday` (0=Sun..6=Sat) in a month, clamped to the last occurrence. */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, ordinal: number): Date {
  const firstWd = new Date(year, month, 1).getDay();
  const offset = (weekday - firstWd + 7) % 7; // days from the 1st to the first `weekday`
  let day = 1 + offset + (ordinal - 1) * 7;
  if (day > lastDayOfMonth(year, month)) day -= 7; // clamp to the last occurrence
  return new Date(year, month, day);
}

/**
 * A `weekday_cycle` card closes ONCE per calendar month, always on the same weekday and the same
 * week-of-month as the anchor. Deriving both from the anchor date guarantees exactly one closing
 * every month (a +28/+35 walk drifts and skips ~one month a year). `nextGap` is kept only for
 * storage/back-compat and is intentionally not used here.
 */
function weekdayClosingForMonth(anchor: string, year: number, month: number): Date {
  const a = parseYmd(anchor);
  const ordinal = Math.ceil(a.getDate() / 7); // 1..5 = which occurrence of the weekday in its month
  return nthWeekdayOfMonth(year, month, a.getDay(), ordinal);
}

/**
 * A `weekday_from` card closes on the first `weekday` on/after day `fromDay` of the month
 * (Cencopay: first Thursday from the 6th → the Thursday that falls between the 6th and the 12th).
 * Clamped back a week if that overflows the month; holidays move it to the previous business day.
 */
function weekdayFromClosingForMonth(year: number, month: number, weekday: number, fromDay: number, businessAdjust: boolean): Date {
  const fromWd = new Date(year, month, fromDay).getDay();
  let day = fromDay + ((weekday - fromWd + 7) % 7);
  if (day > lastDayOfMonth(year, month)) day -= 7;
  let d = new Date(year, month, day);
  if (businessAdjust) d = prevBusinessDay(d);
  return d;
}

/** The single closing of calendar (year, month) for any rule shape — all three close once a month. */
function closingForMonth(rule: ClosingRule, year: number, month: number): Date {
  switch (rule.type) {
    case "fixed_day":
      return fixedClosingForMonth(year, month, rule.day, rule.businessAdjust);
    case "weekday_cycle":
      return weekdayClosingForMonth(rule.anchor, year, month);
    case "weekday_from":
      return weekdayFromClosingForMonth(year, month, rule.weekday, rule.fromDay, rule.businessAdjust);
  }
}

/** Next closing date on or after `from` (defaults to today). */
export function nextClosing(rule: ClosingRule, from: Date = new Date()): Date {
  const start = atMidnight(from);
  // one closing per calendar month — the first one on/after `start`
  for (let i = 0; i < 24; i++) {
    const base = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const c = closingForMonth(rule, base.getFullYear(), base.getMonth());
    if (c >= start) return c;
  }
  const far = new Date(start.getFullYear(), start.getMonth() + 24, 1);
  return closingForMonth(rule, far.getFullYear(), far.getMonth());
}

/** The card's statement closing that falls within calendar (year, month), or null. */
export function closingInMonth(rule: ClosingRule, year: number, month: number): Date | null {
  const c = nextClosing(rule, new Date(year, month, 1));
  return c.getFullYear() === year && c.getMonth() === month ? c : null;
}

/**
 * The closing whose statement is still awaiting payment, or null when nothing is pending:
 * the most recent closing on/before `from`, unless it was already paid (`lastPaymentAt >=
 * closing`) or it happened before the card existed in the app (`since`, yyyy-mm-dd) — a card
 * added today has no resumen from last month to pay. Single source of truth for
 * `currentDueClosing`, `paymentAlert` and `statementPayState`.
 */
export function pendingClosing(
  rule: ClosingRule,
  from: Date = new Date(),
  lastPaymentAt: string | null = null,
  since: string | null = null,
): Date | null {
  const last = lastClosingOnOrBefore(rule, from);
  if (!last) return null;
  if (lastPaymentAt && parseYmd(lastPaymentAt) >= last) return null;
  if (since && last < parseYmd(since)) return null;
  return last;
}

/**
 * The statement currently "due" — the anchor for installment scheduling (offset 0).
 * It's the pending closing (see `pendingClosing`, so a resumen that already closed earlier this
 * month is NOT skipped); otherwise the next upcoming closing.
 */
export function currentDueClosing(
  rule: ClosingRule,
  from: Date = new Date(),
  lastPaymentAt: string | null = null,
  since: string | null = null,
): Date {
  return pendingClosing(rule, from, lastPaymentAt, since) ?? nextClosing(rule, from);
}

/**
 * Walking the closings FORWARD from `start` (offset 0 = `start`), find the one that
 * falls in calendar (year, month) and return it with its offset. Null when that month has no
 * closing ahead (past months, or months the cycle skips). `start` defaults to the next closing
 * on/after `from`; pass `currentDueClosing(...)` to anchor on the resumen actually due now.
 */
export function forwardClosingInMonth(
  rule: ClosingRule,
  year: number,
  month: number,
  from: Date = new Date(),
  start?: Date,
): { closing: Date; offset: number } | null {
  const target = year * 12 + month;
  let c = start ?? nextClosing(rule, from);
  for (let offset = 0; offset < 60; offset++) {
    const cm = c.getFullYear() * 12 + c.getMonth();
    if (cm === target) return { closing: c, offset };
    if (cm > target) return null; // walked past the month without hitting it
    c = nextClosing(rule, addDays(c, 1));
  }
  return null;
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
 * How many statements apart two closings are: 0 = the same one, negative when `b` comes first.
 * Both rule shapes close exactly once per calendar month (see `weekdayClosingForMonth`), so the
 * statement distance is just the month distance.
 */
export function closingSpan(a: Date, b: Date): number {
  return b.getFullYear() * 12 + b.getMonth() - (a.getFullYear() * 12 + a.getMonth());
}

/** Most recent closing on or before `from` (the statement currently awaiting payment). */
export function lastClosingOnOrBefore(rule: ClosingRule, from: Date = new Date()): Date | null {
  const start = atMidnight(from);
  // one closing per calendar month — the last one on/before `start`
  for (let i = 0; i < 24; i++) {
    const base = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const c = closingForMonth(rule, base.getFullYear(), base.getMonth());
    if (c <= start) return c;
  }
  return null;
}

/**
 * Payment alert for a card's current (last-closed) statement.
 * - `hasDebt`: there's something to pay (a fully paid-off card never alerts).
 * - `lastPaymentAt` (yyyy-mm-dd): if the card was paid on/after the current statement's
 *   closing, the statement is considered settled → no alert (fixes the "stuck overdue" bug).
 * - `since` (yyyy-mm-dd): day the card was added; closings before it never alert.
 * Returns null when nothing to flag.
 */
export function paymentAlert(
  rule: ClosingRule,
  dueDays: number | null,
  hasDebt: boolean,
  lastPaymentAt: string | null = null,
  from: Date = new Date(),
  dueSoonDays = 5,
  since: string | null = null,
): { level: "due-soon" | "overdue"; due: Date; days: number } | null {
  if (dueDays == null || !hasDebt) return null;
  const closing = pendingClosing(rule, from, lastPaymentAt, since);
  if (!closing) return null;
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
  closingWeekday?: number | null;
}): ClosingRule | null {
  if (c.closingRuleType === "fixed_day" && c.closingDay != null) {
    return { type: "fixed_day", day: c.closingDay, businessAdjust: !!c.closingBusinessAdjust };
  }
  if (c.closingRuleType === "weekday_cycle" && c.closingAnchor && (c.closingNextGap === 28 || c.closingNextGap === 35)) {
    return { type: "weekday_cycle", anchor: c.closingAnchor, nextGap: c.closingNextGap };
  }
  // weekday_from reuses closing_day as "from day"; the weekday lives in its own column
  if (c.closingRuleType === "weekday_from" && c.closingDay != null && c.closingWeekday != null) {
    return { type: "weekday_from", weekday: c.closingWeekday, fromDay: c.closingDay, businessAdjust: !!c.closingBusinessAdjust };
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

/** Capitalized month label, e.g. "Julio 2026". */
export function fmtMonth(d: Date): string {
  const s = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
