"use client";

import type { Card, FixedExpense, Purchase, Rates } from "@/lib/types";
import { cardMetrics } from "@/lib/calc";
import { paymentAlert, ruleFromCard } from "@/lib/closing";

interface Props {
  cards: Card[];
  purchases: Purchase[];
  rates: Rates;
  fixedExpenses: FixedExpense[];
  onOpenCard: (id: string) => void;
}

interface Item {
  id: string;
  nickname: string;
  level: "due-soon" | "overdue";
  days: number;
}

/** Payment-due alerts (statement due date) across all cards. Renders nothing when none. */
export function CardAlerts({ cards, purchases, rates, fixedExpenses, onOpenCard }: Props) {
  const items: Item[] = [];
  for (const c of cards) {
    const rule = ruleFromCard(c);
    if (!rule) continue;
    const m = cardMetrics(c, purchases, rates, fixedExpenses);
    const a = paymentAlert(rule, c.dueDays ?? null, m.debt > 0.5);
    if (a) items.push({ id: c.id, nickname: c.nickname, level: a.level, days: a.days });
  }
  if (items.length === 0) return null;

  // overdue first, then soonest due
  items.sort((x, y) => (x.level === y.level ? x.days - y.days : x.level === "overdue" ? -1 : 1));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginBottom: 24 }}>
      {items.map((it) => {
        const overdue = it.level === "overdue";
        return (
          <button
            key={it.id}
            onClick={() => onOpenCard(it.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textAlign: "left",
              cursor: "pointer",
              padding: "13px 16px",
              borderRadius: 16,
              border: `1px solid ${overdue ? "rgba(214,69,90,.35)" : "rgba(232,185,78,.4)"}`,
              background: overdue ? "rgba(214,69,90,.08)" : "rgba(232,185,78,.12)",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, flex: "none" }}>{overdue ? "⚠️" : "⏰"}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 800, letterSpacing: "-.01em", color: overdue ? "var(--tj-danger)" : "#a9791f" }}>
                {overdue ? "Pago vencido" : "Vence pronto"}
              </span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--tj-muted-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.nickname} · {overdue ? `hace ${-it.days} ${-it.days === 1 ? "día" : "días"}` : it.days === 0 ? "hoy" : it.days === 1 ? "mañana" : `en ${it.days} días`}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
