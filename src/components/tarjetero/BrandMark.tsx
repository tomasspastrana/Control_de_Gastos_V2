import type { Brand } from "@/lib/types";

export function BrandMark({ brand, size = 19 }: { brand: Brand; size?: number }) {
  if (brand === "visa") {
    return (
      <div
        style={{
          fontStyle: "italic",
          fontWeight: 800,
          fontSize: size,
          letterSpacing: ".02em",
          textShadow: "0 1px 2px rgba(0,0,0,.15)",
        }}
      >
        VISA
      </div>
    );
  }
  const d = size > 19 ? 28 : 24;
  const w = size > 19 ? 46 : 38;
  return (
    <div style={{ position: "relative", width: w, height: d }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: d, height: d, borderRadius: "50%", background: "#EB001B" }} />
      <div style={{ position: "absolute", right: 0, top: 0, width: d, height: d, borderRadius: "50%", background: "#F79E1B", mixBlendMode: "hard-light", opacity: 0.9 }} />
    </div>
  );
}
