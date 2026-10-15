/**
 * One-off migration: re-file the saved `statement_snapshots` under the month each statement
 * BELONGS to instead of the calendar month its closing date fell in.
 *
 * A resumen bills the window between the previous closing and its own, so it belongs to the month
 * holding most of that window (see `statementMonth` in src/lib/closing.ts). A card that closes
 * early bills almost all of the previous month: Cencopay's resumen that closed 10/09 is "Agosto",
 * and the one closing 08/10 is "Septiembre". Rows written before that rule existed carry the
 * closing's own month, so they are one month ahead.
 *
 * This MUST run together with the code change: `period` is what marks a resumen as paid (the
 * unique index on (user_id, card_id, period) is the double-payment lock), so a row left under the
 * old key would make an already-paid statement look unpaid and let it be paid a second time.
 *
 * Rows are rewritten in ascending `period` order per card. Every shift is -1 or 0 month, so that
 * order always frees the destination slot before something moves into it — no unique-index clash.
 *
 *   npm run db:relabel            # dry run, writes nothing
 *   npm run db:relabel -- --apply # rewrite the periods
 */

import { config } from "dotenv";
import postgres from "postgres";
import { parseYmd, ruleFromCard } from "../src/lib/closing";
import { statementPeriod } from "../src/lib/statements";

config({ path: ".env.local" });

const apply = process.argv.slice(2).includes("--apply");

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL / DIRECT_URL en .env.local");
  process.exit(1);
}
const sql = postgres(url, { prepare: false });

interface Row {
  id: string;
  card_id: string;
  nickname: string;
  period: string;
  closing_date: string | null;
  paid_at: string | null;
  closing_rule_type: string | null;
  closing_day: number | null;
  closing_business_adjust: boolean | null;
  closing_anchor: string | null;
  closing_next_gap: number | null;
  closing_weekday: number | null;
}

async function main() {
  // dates come back as text so they never drift through a JS Date/timezone round trip
  const rows = await sql<Row[]>`
    select s.id, s.card_id, s.nickname,
           s.period::text as period, s.closing_date::text as closing_date, s.paid_at::text as paid_at,
           c.closing_rule_type, c.closing_day, c.closing_business_adjust,
           c.closing_anchor::text as closing_anchor, c.closing_next_gap, c.closing_weekday
      from statement_snapshots s
      join cards c on c.id = s.card_id
     order by s.nickname, s.period
  `;

  if (rows.length === 0) {
    console.log("No hay resúmenes guardados. Nada para re-etiquetar.");
    return;
  }

  const moves: { id: string; period: string }[] = [];
  let unchanged = 0;
  let skipped = 0;

  for (const r of rows) {
    const label = `${r.nickname.padEnd(22)} ${r.period}`;
    if (!r.closing_date) {
      console.log(`   ${label}  sin closing_date — se omite (no se puede recalcular)`);
      skipped++;
      continue;
    }
    const rule = ruleFromCard({
      closingRuleType: r.closing_rule_type,
      closingDay: r.closing_day,
      closingBusinessAdjust: r.closing_business_adjust,
      closingAnchor: r.closing_anchor,
      closingNextGap: r.closing_next_gap,
      closingWeekday: r.closing_weekday,
    });
    if (!rule) {
      console.log(`   ${label}  la tarjeta no tiene ciclo de cierre — se omite`);
      skipped++;
      continue;
    }
    const period = statementPeriod(rule, parseYmd(r.closing_date));
    const paid = r.paid_at ? ` · pagado ${r.paid_at}` : "";
    if (period === r.period) {
      console.log(`   ${label}  cerró ${r.closing_date}${paid} — sin cambios`);
      unchanged++;
      continue;
    }
    console.log(`   ${label}  cerró ${r.closing_date}${paid} → ${period}`);
    moves.push({ id: r.id, period });
  }

  console.log("\n═════════════════════════════════════════════");
  console.log(`${rows.length} resumen(es): ${moves.length} a mover, ${unchanged} sin cambios, ${skipped} omitidos.`);
  if (moves.length === 0) return;
  if (!apply) {
    console.log("Dry run: no se escribió nada. Revisá las líneas de arriba.");
    console.log("Para aplicarlo:  npm run db:relabel -- --apply");
    return;
  }

  // `rows` is already ordered by period, so the moves keep that order: with every shift being
  // -1 or 0 months, the slot a row moves into has always been vacated first.
  await sql.begin(async (tx) => {
    for (const m of moves) {
      await tx`update statement_snapshots set period = ${m.period}::date where id = ${m.id}`;
    }
  });
  console.log(`✓ ${moves.length} resumen(es) re-etiquetados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
