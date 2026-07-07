"use client";

import { motion } from "motion/react";
import type { AppData, Card } from "@/lib/types";
import {
  cardMetrics,
  catColor,
  categoryBreakdown,
  fmt,
  fmtCur,
  fmtDate,
  fmtShort,
  purchaseTotalArs,
  totals,
} from "@/lib/calc";
import { CreditCardVisual } from "./CreditCardVisual";
import { StatTile } from "./StatTile";
import { ProgressBar } from "./ProgressBar";
import { DonutChart } from "./DonutChart";

interface Props {
  data: AppData;
  userName: string;
  onAddCard: () => void;
  onOpenCard: (id: string) => void;
  onDeleteCard: (id: string) => void;
}

function DashCard({ card, data, onOpen, onDelete }: { card: Card; data: AppData; onOpen: () => void; onDelete: () => void }) {
  const m = cardMetrics(card, data.purchases, data.rates);
  return (
    <div style={{ background: "rgba(255,255,255,.55)", borderRadius: 26, padding: 12, border: "1px solid rgba(255,255,255,.7)", boxShadow: "0 8px 30px rgba(80,70,160,.1)" }}>
      <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 320, damping: 22 }} style={{ cursor: "pointer" }} onClick={onOpen}>
        <CreditCardVisual card={card} height={180} />
      </motion.div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px 4px" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--tj-muted)", fontWeight: 600 }}>Deuda</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tj-debt)", fontVariantNumeric: "tabular-nums" }}>{fmt(m.debt)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--tj-muted)", fontWeight: 600 }}>Disponible</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--tj-good)", fontVariantNumeric: "tabular-nums" }}>{fmt(m.avail)}</div>
        </div>
      </div>
      <div style={{ padding: "6px 14px 4px" }}>
        <ProgressBar pct={m.pct} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10.5, color: "var(--tj-muted)", fontWeight: 600 }}>{Math.round(m.pct * 100)}% usado</span>
          <button onClick={onDelete} style={{ border: "none", background: "none", color: "#c86", fontSize: 10.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

export function Dashboard({ data, userName, onAddCard, onOpenCard, onDeleteCard }: Props) {
  const t = totals(data.cards, data.purchases, data.rates);
  const breakdown = categoryBreakdown(data.purchases, data.rates);

  const cardName = (id: string) => data.cards.find((c) => c.id === id)?.nickname ?? "—";
  const recent = [...data.purchases]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--tj-muted)", fontWeight: 600, letterSpacing: ".02em" }}>Resumen general</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 30, fontWeight: 800, letterSpacing: "-.03em" }}>Hola, {userName || "qué tal"} 👋</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--tj-muted)", fontWeight: 600 }}>Deuda total (ARS)</div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: "var(--tj-debt)", fontVariantNumeric: "tabular-nums" }}>{fmt(t.debt)}</div>
        </div>
      </div>

      {/* stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 16, marginBottom: 28 }}>
        <StatTile label="Límite total" value={fmt(t.limit)} />
        <StatTile label="Disponible total" value={fmt(t.avail)} valueColor="var(--tj-good)" />
        <StatTile label="Tarjetas · Compras activas" value={`${data.cards.length} · ${data.purchases.length}`} />
      </div>

      {/* main grid */}
      <div className="tj-dashgrid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(320px,380px)", gap: 24, alignItems: "start" }}>
        {/* left: cards */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>Tarjetas</h2>
            <button onClick={onAddCard} className="tj-cta" style={{ border: "none", background: "rgba(109,94,246,.1)", color: "var(--tj-accent)", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 11, cursor: "pointer" }}>+ Agregar</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
            {data.cards.map((c) => (
              <DashCard key={c.id} card={c} data={data} onOpen={() => onOpenCard(c.id)} onDelete={() => onDeleteCard(c.id)} />
            ))}
          </div>
        </div>

        {/* right: charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="tj-glass" style={{ padding: 22, borderRadius: 24 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, letterSpacing: "-.02em" }}>Gastos por categoría</h2>
            <div style={{ fontSize: 11.5, color: "var(--tj-muted)", fontWeight: 600, marginBottom: 16 }}>Total comprado · en ARS</div>
            {breakdown.entries.length > 0 ? (
              <>
                <DonutChart conic={breakdown.conic} centerValue={fmtShort(breakdown.total)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {breakdown.entries.map((cat) => (
                    <div key={cat.name}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                        <span style={{ width: 12, height: 12, borderRadius: 4, flex: "none", background: cat.color }} />
                        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{cat.name}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(cat.amount)}</span>
                        <span style={{ fontSize: 11, color: "var(--tj-muted)", fontWeight: 600, width: 38, textAlign: "right" }}>{Math.round(cat.pct * 100)}%</span>
                      </div>
                      <ProgressBar pct={cat.pct} height={6} track="rgba(0,0,0,.05)" fill={cat.color} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "30px 10px", color: "#9a96b6", fontSize: 13, fontWeight: 600 }}>Cargá compras para ver el desglose.</div>
            )}
          </div>

          <div className="tj-glass" style={{ padding: 22, borderRadius: 24 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 800, letterSpacing: "-.02em" }}>Compras recientes</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {recent.map((r) => (
                <div key={r.id} className="tj-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 6px" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, flex: "none", background: catColor(r.category) }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.merchant}</div>
                    <div style={{ fontSize: 11, color: "var(--tj-muted)", fontWeight: 600 }}>{cardName(r.cardId)} · {fmtDate(r.date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(purchaseTotalArs(r, data.rates))}</div>
                    <div style={{ fontSize: 10.5, color: "var(--tj-muted)", fontWeight: 600 }}>{fmtCur(r.amount, r.currency)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
