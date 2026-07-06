import type { CSSProperties } from "react";
import type { Card } from "@/lib/types";
import { hexA, maskedNumber, themeColors } from "@/lib/calc";
import { BrandMark } from "./BrandMark";

export type CardDesign = "gradient" | "frost" | "noir";

function bgStyle(theme: Card["theme"], design: CardDesign): CSSProperties {
  const [a, b] = themeColors(theme);
  const base: CSSProperties = { position: "absolute", inset: 0, borderRadius: 22 };
  if (design === "frost")
    return { ...base, background: `linear-gradient(135deg, ${hexA(a, 0.62)}, ${hexA(b, 0.34)})`, backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.4)" };
  if (design === "noir")
    return { ...base, background: "linear-gradient(135deg,#25252f,#3a3a49)", boxShadow: `inset 4px 0 0 ${a}` };
  return { ...base, background: `linear-gradient(135deg, ${a} 0%, ${b} 100%)` };
}

interface Props {
  card: Card;
  height?: number;
  design?: CardDesign;
  /** larger typography for the detail view */
  large?: boolean;
}

export function CreditCardVisual({ card, height = 180, design = "noir", large = false }: Props) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        padding: 18,
        height,
        overflow: "hidden",
        boxShadow: "0 14px 34px rgba(80,60,180,.22)",
      }}
    >
      <div style={bgStyle(card.theme, design)} />
      <div
        style={{
          position: "absolute",
          top: -30,
          right: -20,
          width: large ? 170 : 150,
          height: large ? 170 : 150,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(255,255,255,.28),transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: large ? 12 : 11, opacity: 0.85, fontWeight: 600, letterSpacing: ".03em" }}>{card.nickname}</div>
            <div style={{ fontSize: large ? 11 : 10.5, opacity: 0.7, fontWeight: 500, marginTop: large ? 2 : 1 }}>Venc. {card.expiry}</div>
          </div>
          <BrandMark brand={card.brand} size={large ? 23 : 19} />
        </div>
        <div>
          <div
            style={{
              fontSize: large ? 18 : 15,
              fontWeight: 600,
              letterSpacing: large ? ".16em" : ".14em",
              fontVariantNumeric: "tabular-nums",
              marginBottom: large ? 12 : 9,
            }}
          >
            {maskedNumber(card.last4)}
          </div>
          <div style={{ fontSize: 9, opacity: 0.7, letterSpacing: ".1em", textTransform: "uppercase" }}>Titular</div>
          <div style={{ fontSize: large ? 14 : 12.5, fontWeight: 700, letterSpacing: ".02em" }}>{card.holder}</div>
        </div>
      </div>
    </div>
  );
}
