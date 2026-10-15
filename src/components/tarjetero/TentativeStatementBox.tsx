"use client";

import type { Card, FixedExpense, Purchase, Rates } from "@/lib/types";
import { daysLabel, daysUntil, fmtClosing, fmtMonth, parseYmd, ruleFromCard } from "@/lib/closing";
import { openStatement, statementPeriod } from "@/lib/statements";
import { OwnAmount } from "./OwnAmount";
import { Box, Note } from "./StatementPayBox";

interface Props {
  card: Card;
  purchases: Purchase[];
  fixedExpenses: FixedExpense[];
  rates: Rates;
}

/**
 * The resumen still being built, read-only. Deliberately has no button: a statement can only be
 * paid once it closes, and that happens in `StatementPayBox` — this is just so the card doesn't
 * go silent (showing only "pagado") between one closing and the next.
 */
export function TentativeStatementBox({ card, purchases, fixedExpenses, rates }: Props) {
  const rule = ruleFromCard(card);
  const stmt = rule ? openStatement(card, purchases, fixedExpenses, rates) : null;
  if (!rule || !stmt?.closing) return null; // no cycle configured → StatementPayBox already says so

  const closeDays = daysUntil(stmt.closing);

  return (
    <Box>
      <div className="text-[9.5px] font-extrabold uppercase" style={{ letterSpacing: ".06em", color: "var(--tj-muted-2)" }}>
        En curso · tentativo
      </div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold">Resumen de {fmtMonth(parseYmd(statementPeriod(rule, stmt.closing)))}</div>
          <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
            cierra {fmtClosing(stmt.closing)} · {daysLabel(closeDays)}
          </div>
          {stmt.due && (
            <div className="text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
              vence {fmtClosing(stmt.due)}
            </div>
          )}
        </div>
        <div className="shrink-0 text-right text-[15px] font-extrabold" style={{ color: "var(--tj-debt)", fontVariantNumeric: "tabular-nums" }}>
          {stmt.total > 0.5 ? (
            <OwnAmount main={stmt.ownTotal} alt={stmt.total} altLabel="Total real del resumen" iconSize={12} />
          ) : (
            <span className="text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>sin cargos todavía</span>
          )}
        </div>
      </div>
      <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid rgba(120,110,180,.16)" }}>
        <Note>Puede cambiar hasta el cierre.</Note>
      </div>
    </Box>
  );
}
