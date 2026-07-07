"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { debtSchema } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { fmt, rate } from "@/lib/calc";
import { CURRENCIES, type Currency, type Debt, type Rates } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (debt: Debt) => void;
  rates: Rates;
}

const emptyForm = () => ({
  creditor: "",
  note: "",
  amount: "",
  currency: "ARS" as Currency,
  installments: "12",
  paidInstallments: "0",
});

export function NewDebtModal({ open, onClose, onCreate, rates }: Props) {
  const [f, setF] = useState(emptyForm());

  useEffect(() => {
    if (open) setF(emptyForm());
  }, [open]);

  const set = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: (typeof f)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const preview = fmt((parseFloat(f.amount) || 0) * rate(rates, f.currency));

  function submit() {
    const parsed = debtSchema.safeParse(f);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const d = parsed.data;
    const debt: Debt = {
      id: uid("d"),
      creditor: d.creditor,
      note: d.note,
      amount: d.amount,
      currency: d.currency,
      installments: d.installments,
      paidInstallments: d.paidInstallments,
    };
    onCreate(debt);
    toast.success("Deuda registrada");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tj-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Nueva deuda personal</DialogTitle>
        </DialogHeader>
        <div className="mb-4 text-xs font-semibold" style={{ color: "var(--tj-muted)" }}>
          No pertenece a ninguna tarjeta. Ej: &ldquo;Mi primo me prestó 1000 en 12 cuotas&rdquo;.
        </div>
        <div className="tj-field">
          <label className="tj-label">Acreedor / a quién le debés</label>
          <input className="tj-input" value={f.creditor} onChange={(e) => set("creditor", e.target.value)} placeholder="Ej: Mi primo Juan" />
        </div>
        <div className="tj-field">
          <label className="tj-label">Detalle (opcional)</label>
          <input className="tj-input" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Ej: Préstamo para la moto" />
        </div>
        <div className="flex gap-3">
          <div className="tj-field" style={{ flex: 1.5 }}>
            <label className="tj-label">Monto</label>
            <input className="tj-input" value={f.amount} inputMode="decimal" onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))} placeholder="1000" />
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
        <button onClick={submit} className="tj-submit mt-2">Agregar deuda</button>
      </DialogContent>
    </Dialog>
  );
}
