"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ratesSchema } from "@/lib/schemas";
import type { Rates } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  rates: Rates;
  onSave: (rates: Partial<Rates>) => void;
}

export function SettingsModal({ open, onClose, rates, onSave }: Props) {
  const [usd, setUsd] = useState(String(rates.USD));
  const [eur, setEur] = useState(String(rates.EUR));

  useEffect(() => {
    if (open) {
      setUsd(String(rates.USD));
      setEur(String(rates.EUR));
    }
  }, [open, rates.USD, rates.EUR]);

  function submit() {
    const parsed = ratesSchema.safeParse({ usd, eur });
    if (!parsed.success) {
      toast.error("Ingresá valores válidos");
      return;
    }
    onSave({ USD: parsed.data.usd, EUR: parsed.data.eur });
    toast.success("Tipo de cambio actualizado");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tj-modal" style={{ maxWidth: 400 }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">Tipo de cambio</DialogTitle>
        </DialogHeader>
        <div className="mb-4 text-xs font-semibold" style={{ color: "var(--tj-muted)" }}>
          Todo se convierte a ARS (moneda base).
        </div>
        <div className="tj-field">
          <label className="tj-label">1 USD equivale a (ARS)</label>
          <input className="tj-input" value={usd} inputMode="decimal" onChange={(e) => setUsd(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <div className="tj-field">
          <label className="tj-label">1 EUR equivale a (ARS)</label>
          <input className="tj-input" value={eur} inputMode="decimal" onChange={(e) => setEur(e.target.value.replace(/[^\d.]/g, ""))} />
        </div>
        <button onClick={submit} className="tj-submit mt-2.5">Guardar</button>
      </DialogContent>
    </Dialog>
  );
}
