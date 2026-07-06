import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  valueColor?: string;
  big?: boolean;
}

export function StatTile({ label, value, valueColor, big = false }: Props) {
  return (
    <div className="tj-glass" style={{ padding: "20px 22px", borderRadius: 22 }}>
      <div style={{ fontSize: 12, color: "var(--tj-muted)", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          fontSize: big ? 24 : 23,
          fontWeight: 800,
          letterSpacing: "-.02em",
          fontVariantNumeric: "tabular-nums",
          color: valueColor,
        }}
      >
        {value}
      </div>
    </div>
  );
}
