"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Card, FixedExpense, Purchase, Rates, StatementSnapshot } from "@/lib/types";
import { fmt } from "@/lib/calc";
import { fmtClosing, fmtMonth, parseYmd, ruleFromCard } from "@/lib/closing";
import { cardStatement, generalStatement, periodKey } from "@/lib/statements";
import { StatTile } from "./StatTile";

interface Props {
  cards: Card[];
  purchases: Purchase[];
  fixedExpenses: FixedExpense[];
  rates: Rates;
  snapshots: StatementSnapshot[];
  onOpenCard: (id: string) => void;
}

const monthLabel = (y: number, m: number) => fmtMonth(new Date(y, m, 1));

export function StatementsView({ cards, purchases, fixedExpenses, rates, snapshots, onOpenCard }: Props) {
  const today = new Date();
  const [anchor, setAnchor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const isCurrent = anchor.y === today.getFullYear() && anchor.m === today.getMonth();

  const move = (delta: number) => {
    const d = new Date(anchor.y, anchor.m + delta, 1);
    setAnchor({ y: d.getFullYear(), m: d.getMonth() });
  };

  // next-3-months projection (from the anchor) — always live, nothing ahead is paid yet
  const projection = useMemo(() => {
    return [1, 2, 3].map((k) => {
      const d = new Date(anchor.y, anchor.m + k, 1);
      const g = generalStatement(cards, purchases, fixedExpenses, rates, d.getFullYear(), d.getMonth(), today);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d.getFullYear(), d.getMonth()), total: g.total };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, purchases, fixedExpenses, rates, anchor]);

  const periodStr = periodKey(anchor.y, anchor.m);
  const isPast = anchor.y * 12 + anchor.m < today.getFullYear() * 12 + today.getMonth();

  /**
   * One row per card, merged: a paid statement comes from its frozen snapshot, an unpaid one is
   * computed live. Per card and not per month — a month where one card is paid and another isn't
   * has to show both, which the old all-or-nothing "mes cerrado" flag hid.
   */
  const rows = useMemo(
    () =>
      cards.map((card) => {
        const snap = snapshots.find((s) => s.cardId === card.id && s.period === periodStr);
        if (snap) {
          return {
            card,
            paid: true,
            nickname: snap.nickname,
            closing: snap.closingDate ? parseYmd(snap.closingDate) : null,
            due: snap.dueDate ? parseYmd(snap.dueDate) : null,
            paidAt: snap.paidAt ? parseYmd(snap.paidAt) : null,
            total: snap.total,
            items: snap.items,
          };
        }
        const stmt = cardStatement(card, purchases, fixedExpenses, rates, anchor.y, anchor.m, today);
        return {
          card,
          paid: false,
          nickname: card.nickname,
          closing: stmt.closing,
          due: stmt.due,
          paidAt: null,
          total: stmt.total,
          items: stmt.items,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, purchases, fixedExpenses, rates, snapshots, anchor, periodStr],
  );

  const billed = useMemo(() => [...rows].filter((r) => r.items.length > 0).sort((a, b) => b.total - a.total), [rows]);
  const generalTotal = billed.reduce((s, r) => s + r.total, 0);
  const paidTotal = billed.filter((r) => r.paid).reduce((s, r) => s + r.total, 0);
  const anyPaid = paidTotal > 0;
  const allPaid = anyPaid && billed.every((r) => r.paid);

  const navBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="cursor-pointer rounded-[11px] px-3 py-2 text-[13px] font-bold" style={{ border: "1px solid rgba(120,110,180,.22)", background: "rgba(255,255,255,.6)", color: "var(--tj-debt)" }}>
      {label}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="mb-1 text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)", letterSpacing: ".02em" }}>Los resúmenes pagados se guardan solos; el resto sale del cronograma de cuotas</div>
      <h1 className="mt-0.5 mb-4 text-[28px] font-extrabold tracking-tight">Resúmenes</h1>

      {/* month navigator */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {navBtn("← Mes anterior", () => move(-1))}
        <div className="flex min-w-[150px] flex-col items-center">
          <span className="text-[16px] font-extrabold tracking-tight">{monthLabel(anchor.y, anchor.m)}</span>
          {allPaid && <span className="text-[10.5px] font-bold" style={{ color: "var(--tj-good)" }}>✓ todo pagado</span>}
        </div>
        {navBtn("Mes siguiente →", () => move(1))}
        {!isCurrent && navBtn("Hoy", () => setAnchor({ y: today.getFullYear(), m: today.getMonth() }))}
      </div>

      {/* GENERAL */}
      <h2 className="mb-3 text-[17px] font-extrabold tracking-tight">Resumen general</h2>
      {billed.length > 0 ? (
        <div className="tj-glass mb-4 max-w-[720px]" style={{ padding: "20px 22px", borderRadius: 22 }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                {allPaid ? "Total pagado" : "Total del mes"} · {monthLabel(anchor.y, anchor.m)}
              </div>
              <div className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--tj-debt)", fontVariantNumeric: "tabular-nums" }}>{fmt(generalTotal)}</div>
              {anyPaid && !allPaid && (
                <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                  <span style={{ color: "var(--tj-good)" }}>{fmt(paidTotal)} pagado</span> · {fmt(generalTotal - paidTotal)} pendiente
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {billed.map((r) => (
              <div key={r.card.id} className="tj-row flex items-center gap-3 py-2" style={{ borderTop: "1px solid rgba(120,110,180,.12)" }}>
                <span className="min-w-0 flex-1 text-[13.5px] font-bold" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nickname}</span>
                {r.paid ? (
                  <PaidChip />
                ) : (
                  r.due && <span className="text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>vence {fmtClosing(r.due)}</span>
                )}
                <span className="text-[14px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 max-w-[720px] rounded-[20px] px-5 py-10 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
          {isPast
            ? `Sin resúmenes pagados en ${monthLabel(anchor.y, anchor.m)}.`
            : `Nada a pagar en ${monthLabel(anchor.y, anchor.m)}.`}
        </div>
      )}

      {/* projection */}
      <div className="mb-8 grid max-w-[720px] gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        {projection.map((pr) => (
          <StatTile key={pr.key} label={pr.label} value={fmt(pr.total)} />
        ))}
      </div>

      {/* PER CARD */}
      <h2 className="mb-3 text-[17px] font-extrabold tracking-tight">Por tarjeta</h2>
      {cards.length > 0 ? (
        // one card per card, paid ones from their frozen snapshot and the rest computed live
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
          {rows.map((r) => {
            const emptyMsg = !ruleFromCard(r.card)
              ? "Configurá el ciclo de cierre para ver su resumen."
              : isPast
                ? `Sin pago registrado en ${monthLabel(anchor.y, anchor.m)}.`
                : !r.closing
                  ? `No cierra resumen en ${monthLabel(anchor.y, anchor.m)}.`
                  : "Sin cuotas ni gastos pendientes este mes.";
            return (
              <div key={r.card.id} className="tj-glass-soft" style={{ padding: 20, borderRadius: 22 }}>
                <button onClick={() => onOpenCard(r.card.id)} className="mb-3 flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent p-0 text-left">
                  <div className="min-w-0">
                    <div className="text-[15.5px] font-extrabold tracking-tight">{r.nickname}</div>
                    <div className="mt-px text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                      {r.closing ? <>{r.paid ? "cerró" : "cierra"} {fmtClosing(r.closing)}</> : "sin cierre este mes"}
                      {r.due && <> · {r.paid ? "venció" : "vence"} {fmtClosing(r.due)}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold" style={{ fontVariantNumeric: "tabular-nums", color: "var(--tj-debt)" }}>{fmt(r.total)}</div>
                    <div className="text-[10.5px] font-semibold" style={{ color: r.paid ? "var(--tj-good)" : "var(--tj-muted)" }}>
                      {r.paid ? (r.paidAt ? `pagado ${fmtClosing(r.paidAt)}` : "pagado") : "total del mes"}
                    </div>
                  </div>
                </button>
                {r.items.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {r.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: "1px solid rgba(120,110,180,.1)" }}>
                        <span style={{ width: 9, height: 9, borderRadius: 3, flex: "none", background: it.kind === "fixed" ? "var(--tj-muted-2)" : "var(--tj-accent)" }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-bold" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</div>
                          <div className="text-[11px] font-semibold" style={{ color: "var(--tj-muted)" }}>{it.sub}</div>
                        </div>
                        <span className="text-[13px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums", color: "var(--tj-ink)" }}>{fmt(it.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-2 text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>{emptyMsg}</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-w-[720px] rounded-[20px] px-5 py-10 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
          Todavía no tenés tarjetas.
        </div>
      )}
    </motion.div>
  );
}

function PaidChip() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: "rgba(47,158,111,.14)", color: "var(--tj-good)" }}
    >
      pagado
    </span>
  );
}
