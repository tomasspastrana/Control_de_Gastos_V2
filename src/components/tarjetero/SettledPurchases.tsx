"use client";

import type { Purchase, Rates } from "@/lib/types";
import { catColor, fmt, fmtCur, fmtDate, hexA, rate } from "@/lib/calc";

interface Props {
  purchases: Purchase[]; // already filtered to fully-paid ones
  rates: Rates;
  onUnpay: (id: string) => void;
  onEdit: (p: Purchase) => void;
  onDelete: (id: string) => void;
}

/**
 * Fully-paid purchases, folded away. They keep piling up on a card and pushed the active ones
 * off-screen, but they can't just be hidden: a mis-recorded payment is fixed from here, so the
 * expanded rows keep the same actions the main list has.
 */
export function SettledPurchases({ purchases, rates, onUnpay, onEdit, onDelete }: Props) {
  if (purchases.length === 0) return null;
  const total = purchases.reduce((s, p) => s + p.amount * rate(rates, p.currency), 0);

  return (
    <details className="tj-settled mt-3.5">
      <summary
        className="flex cursor-pointer list-none items-center gap-2.5 rounded-[16px] px-[18px] py-3.5"
        style={{ background: "rgba(255,255,255,.45)", border: "1px solid rgba(120,110,180,.16)" }}
      >
        <span className="tj-settled-caret text-[11px]" style={{ color: "var(--tj-muted)" }} aria-hidden>
          ▶
        </span>
        <span className="flex-1 text-[13.5px] font-extrabold tracking-tight" style={{ color: "var(--tj-muted-2)" }}>
          Compras saldadas ({purchases.length})
        </span>
        <span className="text-[13px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums", color: "var(--tj-muted)" }}>
          {fmt(total)}
        </span>
      </summary>

      <div className="mt-2 flex flex-col gap-1.5">
        {purchases.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[13px] px-[15px] py-2.5"
            style={{ background: "rgba(255,255,255,.4)", border: "1px solid rgba(120,110,180,.1)" }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 3, flex: "none", background: hexA(catColor(p.category), 0.5) }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.merchant}
              </div>
              <div className="text-[10.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                {p.installments}/{p.installments} cuotas · {fmtDate(p.date)}
              </div>
            </div>
            <span className="text-[13px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums", color: "var(--tj-muted-2)" }}>
              {fmtCur(p.amount, p.currency)}
            </span>
            <div className="flex gap-1.5">
              <SmallBtn onClick={() => onEdit(p)}>Editar</SmallBtn>
              <SmallBtn onClick={() => onUnpay(p.id)} title="Devuelve una cuota a pendiente">
                − Cuota
              </SmallBtn>
              <SmallBtn onClick={() => onDelete(p.id)} danger>
                Eliminar
              </SmallBtn>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function SmallBtn({ children, onClick, title, danger = false }: { children: React.ReactNode; onClick: () => void; title?: string; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="cursor-pointer rounded-[9px] px-2.5 py-1.5 text-[11px] font-bold"
      style={
        danger
          ? { border: "none", background: "rgba(214,69,90,.08)", color: "var(--tj-danger)" }
          : { border: "1px solid rgba(0,0,0,.1)", background: "transparent", color: "var(--tj-muted-2)" }
      }
    >
      {children}
    </button>
  );
}
