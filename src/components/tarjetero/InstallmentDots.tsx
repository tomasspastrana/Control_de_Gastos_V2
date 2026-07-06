interface Props {
  installments: number;
  paid: number;
  accent?: string;
}

/** Row of per-installment dots (matches prototype; only render when installments <= 14). */
export function InstallmentDots({ installments, paid, accent = "var(--tj-accent)" }: Props) {
  if (installments > 14) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-[7px]">
      {Array.from({ length: installments }).map((_, i) => {
        const isPaid = i < paid;
        const isNext = i === paid;
        return (
          <div
            key={i}
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: isPaid ? "#fff" : "#b7b3cc",
              background: isPaid ? "#1c1c22" : "transparent",
              border: isPaid
                ? "2px solid #1c1c22"
                : isNext
                  ? `2px solid ${accent}`
                  : "2px solid rgba(0,0,0,.18)",
            }}
          >
            {isPaid ? "✓" : ""}
          </div>
        );
      })}
    </div>
  );
}
