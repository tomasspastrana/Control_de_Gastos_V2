"use client";

import type { CSSProperties } from "react";
import type { Card, Purchase, Rates } from "@/lib/types";
import { cardMetrics, fmt, themeColors } from "@/lib/calc";

type View = "dashboard" | "card" | "debts";

const navBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "11px 15px",
  border: "none",
  borderRadius: 14,
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  background: "transparent",
  color: "var(--tj-muted-2)",
};
const navActive: CSSProperties = {
  background: "rgba(255,255,255,.6)",
  color: "var(--tj-debt)",
  boxShadow: "0 4px 14px rgba(80,70,160,.1)",
};

interface Props {
  cards: Card[];
  purchases: Purchase[];
  rates: Rates;
  view: View;
  selectedCardId: string | null;
  debtsCount: number;
  onAddPurchase: () => void;
  onGoHome: () => void;
  onGoDebts: () => void;
  onAddCard: () => void;
  onOpenSettings: () => void;
  onOpenCard: (id: string) => void;
}

export function Sidebar({ cards, purchases, rates, view, selectedCardId, debtsCount, onAddPurchase, onGoHome, onGoDebts, onAddCard, onOpenSettings, onOpenCard }: Props) {
  return (
    <aside className="tj-side" style={{ display: "flex", flexDirection: "column", gap: 14, padding: "22px 18px", height: "100vh", position: "sticky", top: 0 }}>
      {/* logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 6px 8px" }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--tj-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(109,94,246,.4)" }}>
          <div style={{ width: 15, height: 11, borderRadius: 3, border: "2px solid #fff" }} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.02em" }}>Tarjetero</div>
          <div style={{ fontSize: 10.5, color: "var(--tj-muted)", fontWeight: 500, letterSpacing: ".04em" }}>FINANZAS · PREMIUM</div>
        </div>
      </div>

      {/* primary action */}
      <button onClick={onAddPurchase} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", border: "none", borderRadius: 16, background: "var(--tj-grad)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: "0 10px 24px rgba(109,94,246,.38)" }}>
        <span style={{ width: 22, height: 22, borderRadius: 8, background: "rgba(255,255,255,.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 400, lineHeight: 1 }}>+</span>
        Cargar compra
      </button>

      {/* nav */}
      <button onClick={onGoHome} style={{ ...navBase, ...(view === "dashboard" ? navActive : {}) }}>
        <span style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>◧</span> Inicio
      </button>
      <button onClick={onGoDebts} style={{ ...navBase, ...(view === "debts" ? navActive : {}) }}>
        <span style={{ width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>🤝</span> Deudas personales
        {debtsCount > 0 && (
          <span style={{ marginLeft: "auto", background: "rgba(109,94,246,.14)", color: "var(--tj-accent)", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20 }}>{debtsCount}</span>
        )}
      </button>

      <div style={{ marginTop: 6, padding: "0 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "#9a96b6", textTransform: "uppercase" }}>Mis tarjetas</div>

      {/* card list */}
      <div className="tj-sidecards" style={{ display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", flex: 1, paddingRight: 2 }}>
        {cards.map((c) => {
          const [a, b] = themeColors(c.theme);
          const m = cardMetrics(c, purchases, rates);
          const active = view === "card" && selectedCardId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => onOpenCard(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", border: "none", borderRadius: 13, cursor: "pointer", background: active ? "rgba(255,255,255,.7)" : "transparent", boxShadow: active ? "0 4px 14px rgba(80,70,160,.12)" : "none" }}
            >
              <span style={{ width: 12, height: 12, borderRadius: 4, flex: "none", background: `linear-gradient(135deg,${a},${b})` }} />
              <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nickname}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--tj-muted)", fontWeight: 500 }}>{fmt(m.debt)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button onClick={onAddCard} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, border: "1.5px dashed rgba(109,94,246,.4)", borderRadius: 14, background: "rgba(255,255,255,.35)", color: "var(--tj-accent)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
        + Nueva tarjeta
      </button>
      <button onClick={onOpenSettings} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", border: "none", borderRadius: 14, background: "transparent", color: "var(--tj-muted-2)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>
        ⚙ Ajustes · Tipo de cambio
      </button>
    </aside>
  );
}
