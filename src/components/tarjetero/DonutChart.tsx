interface Props {
  /** CSS conic-gradient string (from categoryBreakdown.conic) */
  conic: string;
  centerTop?: string;
  centerValue: string;
  size?: number;
}

export function DonutChart({ conic, centerTop = "Total", centerValue, size = 168 }: Props) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 18px" }}>
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          borderRadius: "50%",
          background: conic,
          boxShadow: "0 8px 24px rgba(80,70,160,.15)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 22,
            borderRadius: "50%",
            background: "rgba(255,255,255,.9)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--tj-muted)", fontWeight: 600 }}>{centerTop}</div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-.02em",
              color: "var(--tj-debt)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {centerValue}
          </div>
        </div>
      </div>
    </div>
  );
}
