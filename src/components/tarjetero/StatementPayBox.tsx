"use client";

import { fmt } from "@/lib/calc";
import { daysUntil, fmtClosing, fmtMonth, parseYmd } from "@/lib/closing";
import type { CardStatement, PayState } from "@/lib/statements";

interface Props {
  state: PayState;
  onPay: (stmt: CardStatement, closing: Date) => void;
  onUndo: (period: string) => void;
}

function daysLabel(n: number): string {
  if (n < 0) return n === -1 ? "hace 1 día" : `hace ${-n} días`;
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  return `en ${n} días`;
}

/**
 * The one place a statement gets paid. A statement is payable only after it closes and only
 * once — once paid it's in history, and the box shows when the next one opens instead of a
 * button. `PayState` (src/lib/statements.ts) decides which of these four it is.
 */
export function StatementPayBox({ state, onPay, onUndo }: Props) {
  if (state.kind === "no-rule") {
    return (
      <Box>
        <Note>Configurá el ciclo de cierre para poder registrar los pagos del resumen.</Note>
      </Box>
    );
  }

  if (state.kind === "not-closed") {
    return (
      <Box>
        <Note>
          Todavía no cerró ningún resumen. El primero cierra {fmtClosing(state.nextClosing)}.
        </Note>
      </Box>
    );
  }

  if (state.kind === "paid") {
    const { snapshot, closing, period } = state;
    return (
      <Box>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-extrabold" style={{ color: "var(--tj-good)" }}>
              ✓ Resumen de {fmtMonth(closing)} pagado
            </div>
            <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
              {snapshot.paidAt ? `el ${fmtClosing(parseYmd(snapshot.paidAt))} · ` : ""}
              {fmt(snapshot.total)}
            </div>
          </div>
          <button
            onClick={() => onUndo(period)}
            className="shrink-0 cursor-pointer rounded-[10px] px-2.5 py-1.5 text-[11px] font-bold"
            style={{ border: "1px solid rgba(0,0,0,.12)", background: "transparent", color: "var(--tj-muted-2)" }}
            title="Revierte el pago y las cuotas que avanzó"
          >
            Deshacer
          </button>
        </div>
        <div className="mt-2.5 pt-2.5 text-[11.5px] font-semibold" style={{ borderTop: "1px solid rgba(120,110,180,.16)", color: "var(--tj-muted)" }}>
          Próximo cierre {fmtClosing(state.nextClosing)} · {daysLabel(daysUntil(state.nextClosing))}
        </div>
      </Box>
    );
  }

  // payable — the statement closed and has no payment recorded yet
  const { stmt, closing, due } = state;
  if (stmt.total <= 0.5) {
    return (
      <Box>
        <Note>
          El resumen de {fmtMonth(closing)} cerró sin cargos. Nada para pagar.
        </Note>
      </Box>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => onPay(stmt, closing)}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-[15px] border-none p-[13px] text-[13.5px] font-extrabold text-white"
        style={{ background: "#1c1c22", boxShadow: "0 10px 24px rgba(28,28,34,.28)" }}
      >
        ✓ Pagar resumen · {fmt(stmt.total)}
      </button>
      <div className="text-center text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
        Cerró {fmtClosing(closing)}
        {due && <> · vence {fmtClosing(due)}</>}
      </div>
    </div>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[15px]" style={{ padding: "13px 15px", background: "rgba(255,255,255,.5)", border: "1px solid rgba(120,110,180,.18)" }}>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>
      {children}
    </div>
  );
}
