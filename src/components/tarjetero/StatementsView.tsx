"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import type { Card, FixedExpense, Purchase, Rates } from "@/lib/types";
import { fmt } from "@/lib/calc";
import { fmtClosing } from "@/lib/closing";
import { generalStatement } from "@/lib/statements";
import { StatTile } from "./StatTile";

interface Props {
  cards: Card[];
  purchases: Purchase[];
  fixedExpenses: FixedExpense[];
  rates: Rates;
  onOpenCard: (id: string) => void;
}

const monthLabel = (y: number, m: number) => {
  const s = new Date(y, m, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function StatementsView({ cards, purchases, fixedExpenses, rates, onOpenCard }: Props) {
  const today = new Date();
  const [anchor, setAnchor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const isCurrent = anchor.y === today.getFullYear() && anchor.m === today.getMonth();

  const move = (delta: number) => {
    const d = new Date(anchor.y, anchor.m + delta, 1);
    setAnchor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const general = useMemo(
    () => generalStatement(cards, purchases, fixedExpenses, rates, anchor.y, anchor.m),
    [cards, purchases, fixedExpenses, rates, anchor],
  );

  // next-3-months projection (from the anchor)
  const projection = useMemo(() => {
    return [1, 2, 3].map((k) => {
      const d = new Date(anchor.y, anchor.m + k, 1);
      const g = generalStatement(cards, purchases, fixedExpenses, rates, d.getFullYear(), d.getMonth());
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: monthLabel(d.getFullYear(), d.getMonth()), total: g.total };
    });
  }, [cards, purchases, fixedExpenses, rates, anchor]);

  const navBtn = (label: string, onClick: () => void) => (
    <button onClick={onClick} className="cursor-pointer rounded-[11px] px-3 py-2 text-[13px] font-bold" style={{ border: "1px solid rgba(120,110,180,.22)", background: "rgba(255,255,255,.6)", color: "var(--tj-debt)" }}>
      {label}
    </button>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="mb-1 text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)", letterSpacing: ".02em" }}>Calculado del cronograma de cuotas</div>
      <h1 className="mt-0.5 mb-4 text-[28px] font-extrabold tracking-tight">Resúmenes</h1>

      {/* month navigator */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        {navBtn("← Mes anterior", () => move(-1))}
        <div className="min-w-[150px] text-center text-[16px] font-extrabold tracking-tight">{monthLabel(anchor.y, anchor.m)}</div>
        {navBtn("Mes siguiente →", () => move(1))}
        {!isCurrent && navBtn("Hoy", () => setAnchor({ y: today.getFullYear(), m: today.getMonth() }))}
      </div>

      {/* GENERAL */}
      <h2 className="mb-3 text-[17px] font-extrabold tracking-tight">Resumen general</h2>
      {general.perCard.length > 0 ? (
        <div className="tj-glass mb-4 max-w-[720px]" style={{ padding: "20px 22px", borderRadius: 22 }}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>Total a pagar · {monthLabel(anchor.y, anchor.m)}</div>
              <div className="text-[26px] font-extrabold tracking-tight" style={{ color: "var(--tj-debt)", fontVariantNumeric: "tabular-nums" }}>{fmt(general.total)}</div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {general.perCard.map((c) => (
              <div key={c.cardId} className="tj-row flex items-center gap-3 py-2" style={{ borderTop: "1px solid rgba(120,110,180,.12)" }}>
                <span className="min-w-0 flex-1 text-[13.5px] font-bold" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nickname}</span>
                {c.due && <span className="text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>vence {fmtClosing(c.due)}</span>}
                <span className="text-[14px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(c.total)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 max-w-[720px] rounded-[20px] px-5 py-10 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
          Ninguna tarjeta cierra resumen en {monthLabel(anchor.y, anchor.m)}.
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
      {general.perCard.length > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
          {general.perCard.map((c) => (
            <div key={c.cardId} className="tj-glass-soft" style={{ padding: 20, borderRadius: 22 }}>
              <button onClick={() => onOpenCard(c.cardId)} className="mb-3 flex w-full cursor-pointer items-start justify-between gap-3 border-none bg-transparent p-0 text-left">
                <div className="min-w-0">
                  <div className="text-[15.5px] font-extrabold tracking-tight">{c.nickname}</div>
                  <div className="mt-px text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                    {c.closing && <>cierra {fmtClosing(c.closing)}</>}{c.due && <> · vence {fmtClosing(c.due)}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold" style={{ fontVariantNumeric: "tabular-nums", color: "var(--tj-debt)" }}>{fmt(c.total)}</div>
                  <div className="text-[10.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>total del mes</div>
                </div>
              </button>
              <div className="flex flex-col gap-1.5">
                {c.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5" style={{ borderTop: "1px solid rgba(120,110,180,.1)" }}>
                    <span style={{ fontSize: 13, flex: "none" }}>{it.kind === "fixed" ? "🔁" : it.paid ? "✅" : "🧾"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--tj-muted)" }}>{it.sub}{it.paid ? " · pagada" : ""}</div>
                    </div>
                    <span className="text-[13px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums", color: it.paid ? "var(--tj-muted)" : "var(--tj-ink)" }}>{fmt(it.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-[720px] rounded-[20px] px-5 py-10 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
          Sin resúmenes de tarjetas este mes.
        </div>
      )}
    </motion.div>
  );
}
