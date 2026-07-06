interface Props {
  /** 0..1 */
  pct: number;
  height?: number;
  track?: string;
  fill?: string;
}

export function ProgressBar({
  pct,
  height = 7,
  track = "rgba(109,94,246,.14)",
  fill = "var(--tj-grad)",
}: Props) {
  return (
    <div style={{ height, borderRadius: 20, background: track, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: Math.max(3, pct * 100) + "%",
          borderRadius: 20,
          background: fill,
        }}
      />
    </div>
  );
}
