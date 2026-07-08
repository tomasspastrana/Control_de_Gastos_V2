import type { Card } from "@/lib/types";
import { daysUntil, dueDate, fmtClosing, nextClosing, ruleFromCard } from "@/lib/closing";

function daysLabel(n: number): string {
  if (n < 0) return n === -1 ? "hace 1 día" : `hace ${-n} días`;
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  return `en ${n} días`;
}

type AlertLevel = "due-soon" | "overdue" | null;

export function ClosingInfo({ card, compact = false, alert = null }: { card: Card; compact?: boolean; alert?: AlertLevel }) {
  const rule = ruleFromCard(card);
  if (!rule) return null;

  const close = nextClosing(rule);
  const closeDays = daysUntil(close);
  const due = card.dueDays != null ? dueDate(close, card.dueDays) : null;
  const dueDaysLeft = due ? daysUntil(due) : null;
  const estimado = rule.type === "weekday_cycle";

  if (compact) {
    return (
      <div style={{ fontSize: 11, color: "var(--tj-muted)", fontWeight: 600, marginTop: 2 }}>
        Cierra {fmtClosing(close)}
        {due && <> · vence {fmtClosing(due)}</>}
      </div>
    );
  }

  const dueColor =
    alert === "overdue" ? "var(--tj-danger)" : alert === "due-soon" ? "#a9791f" : "var(--tj-debt)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--tj-muted)", fontWeight: 600 }}>Próximo cierre</span>
          <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 20, background: estimado ? "rgba(232,185,78,.18)" : "rgba(47,158,111,.14)", color: estimado ? "#a9791f" : "var(--tj-good)" }}>
            {estimado ? "estimado" : "fijo"}
          </span>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.01em" }}>
          {fmtClosing(close)} <span style={{ fontSize: 12, fontWeight: 700, color: "var(--tj-accent)" }}>· {daysLabel(closeDays)}</span>
        </div>
      </div>

      {due && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--tj-muted)", fontWeight: 600 }}>Vencimiento del pago</span>
          <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: "-.01em", color: dueColor }}>
            {fmtClosing(due)} <span style={{ fontSize: 12, fontWeight: 700 }}>· {daysLabel(dueDaysLeft!)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
