import type { Purchase } from "@/lib/types";

/** "Suegro · 50 %" pill for a purchase someone else is on (renders nothing for purchases fully mine). */
export function SharedBadge({ purchase, size = 10 }: { purchase: Pick<Purchase, "sharedWith" | "myPct">; size?: number }) {
  if (!purchase.sharedWith) return null;
  const theirs = 100 - Math.min(100, Math.max(0, purchase.myPct));
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: size,
        fontWeight: 800,
        letterSpacing: ".02em",
        padding: "1px 6px",
        borderRadius: 20,
        background: "rgba(109,94,246,.12)",
        color: "var(--tj-accent)",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
      }}
      title={theirs === 100 ? `Compra de ${purchase.sharedWith}` : `${purchase.sharedWith} paga el ${theirs} %`}
    >
      {purchase.sharedWith}{theirs < 100 ? ` · ${theirs} %` : ""}
    </span>
  );
}
