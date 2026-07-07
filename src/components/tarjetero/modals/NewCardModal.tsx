"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { cardSchema } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { themeColors } from "@/lib/calc";
import { CURRENCIES, THEMES, type Card, type ThemeName } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (card: Card) => void;
  initialTheme: ThemeName;
}

const emptyForm = (theme: ThemeName) => ({
  nickname: "",
  holder: "Alexandra Vaise",
  brand: "visa" as Card["brand"],
  last4: "",
  expiry: "",
  limit: "",
  limitCurrency: "ARS" as Card["limitCurrency"],
  theme,
});

export function NewCardModal({ open, onClose, onCreate, initialTheme }: Props) {
  const [f, setF] = useState(emptyForm(initialTheme));

  useEffect(() => {
    if (open) setF(emptyForm(initialTheme));
  }, [open, initialTheme]);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  function submit() {
    const parsed = cardSchema.safeParse(f);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const d = parsed.data;
    const card: Card = {
      id: uid("c"),
      nickname: d.nickname,
      holder: d.holder || "—",
      brand: d.brand,
      last4: (d.last4 || "0000").padStart(4, "0").slice(-4),
      limit: d.limit,
      limitCurrency: d.limitCurrency,
      expiry: d.expiry || "--/--",
      theme: d.theme,
    };
    onCreate(card);
    toast.success("Tarjeta creada");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tj-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Nueva tarjeta</DialogTitle>
        </DialogHeader>

        <div>
          <div className="tj-field">
            <label className="tj-label">Nombre / alias de la tarjeta</label>
            <input className="tj-input" value={f.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder="Ej: Santander Visa" />
          </div>
          <div className="tj-field">
            <label className="tj-label">Titular</label>
            <input className="tj-input" value={f.holder} onChange={(e) => set("holder", e.target.value)} placeholder="Ej: Alexandra Vaise" />
          </div>
          <div className="flex gap-3">
            <div className="tj-field flex-1">
              <label className="tj-label">Últimos 4 dígitos</label>
              <input className="tj-input" value={f.last4} maxLength={4} inputMode="numeric" onChange={(e) => set("last4", e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1099" />
            </div>
            <div className="tj-field flex-1">
              <label className="tj-label">Vencimiento</label>
              <input className="tj-input" value={f.expiry} onChange={(e) => set("expiry", e.target.value)} placeholder="08/27" />
            </div>
          </div>

          <label className="tj-label">Marca</label>
          <div className="mb-1 flex gap-2.5">
            {(["visa", "mastercard"] as const).map((b) => {
              const on = f.brand === b;
              return (
                <button
                  key={b}
                  onClick={() => set("brand", b)}
                  className="flex-1 cursor-pointer rounded-[13px] p-[11px] text-[13px] font-extrabold"
                  style={{
                    border: on ? "2px solid var(--tj-accent)" : "1px solid rgba(120,110,180,.22)",
                    background: on ? "rgba(109,94,246,.1)" : "rgba(255,255,255,.6)",
                    color: on ? "var(--tj-accent)" : "var(--tj-muted-2)",
                  }}
                >
                  {b === "visa" ? "VISA" : "Mastercard"}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex gap-3">
            <div className="tj-field" style={{ flex: 1.4 }}>
              <label className="tj-label">Límite</label>
              <input className="tj-input" value={f.limit} inputMode="numeric" onChange={(e) => set("limit", e.target.value.replace(/[^\d.]/g, ""))} placeholder="800000" />
            </div>
            <div className="tj-field flex-1">
              <label className="tj-label">Moneda del límite</label>
              <TjSelect
                value={f.limitCurrency}
                onChange={(v) => set("limitCurrency", v as Card["limitCurrency"])}
                options={CURRENCIES.map((c) => ({ value: c, label: c === "ARS" ? "ARS $" : c }))}
              />
            </div>
          </div>

          <label className="tj-label">Color</label>
          <div className="mb-5 flex gap-2.5">
            {THEMES.map((t) => {
              const [a, b] = themeColors(t);
              return (
                <button
                  key={t}
                  onClick={() => set("theme", t)}
                  className="h-10 w-10 cursor-pointer rounded-xl"
                  style={{
                    background: `linear-gradient(135deg,${a},${b})`,
                    border: f.theme === t ? "3px solid #26233a" : "3px solid transparent",
                    boxShadow: "0 4px 10px rgba(0,0,0,.12)",
                  }}
                  aria-label={`Color ${t}`}
                />
              );
            })}
          </div>

          <button onClick={submit} className="tj-submit">Crear tarjeta</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
