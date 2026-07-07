"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { purchaseSchema, toAmount } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { fmt, rate } from "@/lib/calc";
import { CATEGORIES, CURRENCIES, type Card, type Currency, type Purchase, type Rates } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (purchase: Purchase) => void;
  cards: Card[];
  rates: Rates;
  defaultCardId: string;
}

const emptyForm = (cardId: string) => ({
  cardId,
  merchant: "",
  amount: "",
  currency: "ARS" as Currency,
  installments: "3",
  paidInstallments: "0",
  category: "Tecnología" as string,
  date: new Date().toISOString().slice(0, 10),
});

export function NewPurchaseModal({ open, onClose, onCreate, cards, rates, defaultCardId }: Props) {
  const [f, setF] = useState(emptyForm(defaultCardId));

  useEffect(() => {
    if (open) setF(emptyForm(defaultCardId));
  }, [open, defaultCardId]);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const preview = fmt(toAmount(f.amount) * rate(rates, f.currency));
  const hasCards = cards.length > 0;

  function submit() {
    const parsed = purchaseSchema.safeParse(f);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const d = parsed.data;
    const purchase: Purchase = {
      id: uid("p"),
      cardId: d.cardId,
      merchant: d.merchant || "Compra",
      amount: d.amount,
      currency: d.currency,
      installments: d.installments,
      paidInstallments: d.paidInstallments,
      category: d.category,
      date: d.date,
    };
    onCreate(purchase);
    toast.success("Compra agregada");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tj-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Cargar compra en cuotas</DialogTitle>
        </DialogHeader>

        {hasCards ? (
          <div>
            <div className="tj-field">
              <label className="tj-label">Tarjeta</label>
              <TjSelect
                value={f.cardId}
                onChange={(v) => set("cardId", v)}
                options={cards.map((c) => ({ value: c.id, label: `${c.nickname} ···${c.last4}` }))}
              />
            </div>
            <div className="tj-field">
              <label className="tj-label">Comercio / descripción</label>
              <input className="tj-input" value={f.merchant} onChange={(e) => set("merchant", e.target.value)} placeholder="Ej: Apple Store" />
            </div>
            <div className="flex gap-3">
              <div className="tj-field" style={{ flex: 1.5 }}>
                <label className="tj-label">Monto</label>
                <input className="tj-input" value={f.amount} inputMode="decimal" onChange={(e) => set("amount", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="1200" />
              </div>
              <div className="tj-field flex-1">
                <label className="tj-label">Moneda</label>
                <TjSelect
                  value={f.currency}
                  onChange={(v) => set("currency", v as Currency)}
                  options={CURRENCIES.map((c) => ({ value: c, label: c === "ARS" ? "ARS $" : c }))}
                />
              </div>
            </div>
            <div className="-mt-1.5 mb-1 text-[11.5px] font-bold" style={{ color: "var(--tj-accent)" }}>
              ≈ {preview} en ARS
            </div>
            <div className="flex gap-3">
              <div className="tj-field flex-1">
                <label className="tj-label">Cuotas</label>
                <input className="tj-input" value={f.installments} inputMode="numeric" onChange={(e) => set("installments", e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="tj-field flex-1">
                <label className="tj-label">Cuotas pagadas</label>
                <input className="tj-input" value={f.paidInstallments} inputMode="numeric" onChange={(e) => set("paidInstallments", e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="tj-field flex-1">
                <label className="tj-label">Categoría</label>
                <TjSelect
                  value={f.category}
                  onChange={(v) => set("category", v)}
                  options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                />
              </div>
              <div className="tj-field flex-1">
                <label className="tj-label">Fecha</label>
                <input type="date" className="tj-input" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </div>
            </div>
            <button onClick={submit} className="tj-submit mt-2">Agregar compra</button>
          </div>
        ) : (
          <div className="px-2.5 py-8 text-center font-semibold" style={{ color: "#9a96b6" }}>
            Primero creá una tarjeta.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
