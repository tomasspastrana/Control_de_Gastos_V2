/**
 * One-off repair: rebuild the `statement_snapshots` rows for statements that were paid before
 * payment started writing history (the old "Cerrar mes" recomputed the month from already-mutated
 * data and silently saved nothing).
 *
 * `--period` is the month the statement CLOSED in, which is where Resúmenes files it — not the
 * month it was paid in (a resumen that closes in late July is typically paid in early August).
 * A card is reconstructed when its `last_payment_at` falls between that closing and the next
 * one, i.e. that payment is the one that settled this statement; each purchase's current
 * `paid_installments` is then the cuota that payment covered.
 *
 * RECONSTRUCTION, NOT A BACKUP — read the dry-run before applying:
 *  - a purchase already 100% settled BEFORE this period looks identical to one settled IN it,
 *    so an extra line can slip in;
 *  - purchases deleted or edited after the payment cannot come back;
 *  - fixed expenses are taken as they are today (amounts/actives may have changed since).
 *
 *   npm run db:backfill -- --period 2026-07            # dry run, writes nothing
 *   npm run db:backfill -- --period 2026-07 --apply    # insert the rows
 */

import { config } from "dotenv";
import postgres from "postgres";
import { fmt, rate } from "../src/lib/calc";
import { addDays, closingInMonth, dueDate, nextClosing, parseYmd, ruleFromCard, ymd } from "../src/lib/closing";
import { periodKey } from "../src/lib/statements";
import type { Currency, StatementSnapshotItem } from "../src/lib/types";

config({ path: ".env.local" });

// ---- args ----
const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const periodArg = argv[argv.indexOf("--period") + 1];
if (!/^\d{4}-\d{2}$/.test(periodArg ?? "")) {
  console.error("Falta --period yyyy-mm (ej: --period 2026-07)");
  process.exit(1);
}
const [year, month1] = periodArg.split("-").map(Number);
const month = month1 - 1; // 0-based, like the rest of the codebase
const period = periodKey(year, month);

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL / DIRECT_URL en .env.local");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });

// ---- rows we read (snake_case straight from Postgres) ----
interface CardRow {
  id: string;
  user_id: string;
  nickname: string;
  closing_rule_type: string | null;
  closing_day: number | null;
  closing_business_adjust: boolean | null;
  closing_anchor: string | null;
  closing_next_gap: number | null;
  due_days: number | null;
  last_payment_at: string | null;
}

async function main() {
  // rates are per profile, and cards can belong to different users
  const profiles = await sql<{ id: string; rate_usd: string; rate_eur: string }[]>`
    select id, rate_usd, rate_eur from profiles
  `;
  const ratesByUser = new Map(
    profiles.map((p) => [p.id, { ARS: 1, USD: Number(p.rate_usd), EUR: Number(p.rate_eur) }]),
  );
  const ratesFor = (userId: string) => ratesByUser.get(userId) ?? { ARS: 1, USD: 1015, EUR: 1120 };

  // dates come back as text so they never drift through a JS Date/timezone round trip
  const cards = await sql<CardRow[]>`
    select id, user_id, nickname, closing_rule_type, closing_day, closing_business_adjust,
           closing_anchor::text as closing_anchor, closing_next_gap, due_days,
           last_payment_at::text as last_payment_at
      from cards
     where last_payment_at is not null
     order by nickname
  `;

  if (cards.length === 0) {
    console.log("Ninguna tarjeta tiene un pago registrado. Nada para reconstruir.");
    return;
  }

  const existing = await sql<{ card_id: string }[]>`
    select card_id from statement_snapshots where period = ${period}::date
  `;
  const alreadySaved = new Set(existing.map((e) => e.card_id));

  const toInsert: Record<string, unknown>[] = [];

  for (const c of cards) {
    console.log(`\n── ${c.nickname} ─────────────────────────────`);
    if (alreadySaved.has(c.id)) {
      console.log("   ya tiene resumen guardado en este período — se omite");
      continue;
    }

    const rule = ruleFromCard({
      closingRuleType: c.closing_rule_type,
      closingDay: c.closing_day,
      closingBusinessAdjust: c.closing_business_adjust,
      closingAnchor: c.closing_anchor,
      closingNextGap: c.closing_next_gap,
    });
    if (!rule) {
      console.log("   sin ciclo de cierre configurado — se omite");
      continue;
    }
    const closing = closingInMonth(rule, year, month);
    if (!closing) {
      console.log(`   no cierra resumen en ${periodArg} — se omite`);
      continue;
    }
    // the payment must have landed in this statement's window: after it closed and before the
    // next one closed. Otherwise it settled a different month.
    const nextC = nextClosing(rule, addDays(closing, 1));
    const paid = parseYmd(c.last_payment_at!);
    if (paid < closing || paid >= nextC) {
      console.log(
        `   cierre ${ymd(closing)}, pero el pago fue el ${c.last_payment_at} ` +
          `(fuera de la ventana ${ymd(closing)} → ${ymd(nextC)}) — se omite`,
      );
      continue;
    }

    const purchases = await sql<
      { id: string; merchant: string; amount: string; currency: Currency; installments: number; paid_installments: number }[]
    >`
      select id, merchant, amount, currency, installments, paid_installments
        from purchases
       where card_id = ${c.id}
         and paid_installments >= 1
         and date <= ${ymd(closing)}::date
       order by merchant
    `;
    const fixed = await sql<{ name: string; amount: string; currency: Currency; occupies_limit: boolean }[]>`
      select name, amount, currency, occupies_limit
        from fixed_expenses
       where card_id = ${c.id} and active = true
       order by name
    `;

    const rates = ratesFor(c.user_id);
    const items: StatementSnapshotItem[] = [];
    for (const p of purchases) {
      items.push({
        label: p.merchant,
        // the installment this payment settled is the one it left as "paid"
        sub: `cuota ${p.paid_installments}/${p.installments}`,
        amount: (Number(p.amount) * rate(rates, p.currency)) / (p.installments || 1),
        kind: "purchase",
        purchaseId: p.id,
      });
    }
    for (const f of fixed) {
      items.push({
        label: f.name,
        sub: f.occupies_limit ? "gasto fijo" : "gasto fijo · no ocupa límite",
        amount: Number(f.amount) * rate(rates, f.currency),
        kind: "fixed",
      });
    }

    const total = items.reduce((s, i) => s + i.amount, 0);
    const due = c.due_days != null ? dueDate(closing, c.due_days) : null;

    console.log(`   cerró ${ymd(closing)}${due ? ` · venció ${ymd(due)}` : ""} · pagado ${c.last_payment_at}`);
    for (const i of items) console.log(`     · ${i.label.padEnd(28)} ${i.sub.padEnd(18)} ${fmt(i.amount)}`);
    console.log(`   ${"TOTAL".padEnd(31)} ${" ".repeat(18)} ${fmt(total)}`);

    if (items.length === 0) {
      console.log("   (sin líneas: no se inserta)");
      continue;
    }

    toInsert.push({
      user_id: c.user_id,
      card_id: c.id,
      period,
      nickname: c.nickname,
      closing_date: ymd(closing),
      due_date: due ? ymd(due) : null,
      total,
      // sql.json, not JSON.stringify: a pre-stringified value lands in jsonb as a string scalar.
      // The cast is only because JSONValue wants an index signature that an interface lacks.
      items: sql.json(items as unknown as postgres.JSONValue),
      paid_at: c.last_payment_at,
    });
  }

  console.log("\n═════════════════════════════════════════════");
  if (toInsert.length === 0) {
    console.log("Nada para insertar.");
    return;
  }
  if (!apply) {
    console.log(`Dry run: ${toInsert.length} resumen(es) listos. Revisá las líneas de arriba.`);
    console.log(`Para escribirlos:  npm run db:backfill -- --period ${periodArg} --apply`);
    return;
  }

  for (const row of toInsert) {
    await sql`
      insert into statement_snapshots ${sql(row)}
      on conflict (user_id, card_id, period) do nothing
    `;
  }
  console.log(`✓ ${toInsert.length} resumen(es) insertados en ${periodArg}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
