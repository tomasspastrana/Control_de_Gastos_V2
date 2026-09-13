"use client";

import { Users } from "lucide-react";
import { Hint } from "@/components/ui/hint";
import { fmt, type OtherShare } from "@/lib/calc";

/**
 * An amount that has a second reading when purchases are shared: `main` is what's shown,
 * `alt` is the other total (card total vs. what I owe). When they match, it's just the number —
 * cards nobody shares get zero extra UI. When they differ, a small people icon marks it and
 * hover/tap reveals `alt` plus the per-person breakdown.
 */
export function OwnAmount({
  main,
  alt,
  altLabel,
  others,
  iconSize = 13,
}: {
  main: number;
  alt: number;
  altLabel: string;
  others?: OtherShare[];
  iconSize?: number;
}) {
  if (Math.abs(main - alt) < 0.5) return <>{fmt(main)}</>;
  return (
    <Hint
      content={
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
            <span style={{ color: "var(--tj-muted)" }}>{altLabel}</span>
            <b>{fmt(alt)}</b>
          </div>
          {others && others.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(120,110,180,.16)", marginTop: 2, paddingTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
              {others.map((o) => (
                <div key={o.name} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                  <span style={{ color: "var(--tj-muted)" }}>{o.name} te debe</span>
                  <span>{fmt(o.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      }
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {fmt(main)}
        <Users size={iconSize} style={{ opacity: 0.55, flexShrink: 0 }} aria-label="Compartido" />
      </span>
    </Hint>
  );
}
