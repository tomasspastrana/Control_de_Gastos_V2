"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ratesSchema } from "@/lib/schemas";
import { fetchDollarRate } from "@/app/actions";
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
  const [loadingUsd, setLoadingUsd] = useState(false);
  const [usdHint, setUsdHint] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUsd(String(rates.USD));
      setEur(String(rates.EUR));
      setUsdHint(null);
    }
  }, [open, rates.USD, rates.EUR]);

  async function refreshDollar() {
    setLoadingUsd(true);
    try {
      const q = await fetchDollarRate();
      const value = q.tarjeta ?? q.oficial;
      if (value == null) {
        toast.error("No se pudo obtener el dólar. Probá de nuevo.");
        return;
      }
      setUsd(String(value));
      const parts = [
        q.tarjeta != null ? `tarjeta $${q.tarjeta}` : null,
        q.oficial != null ? `oficial $${q.oficial}` : null,
      ].filter(Boolean);
      setUsdHint(`Dólar ${parts.join(" · ")} (dolarapi.com). Editable y se guarda al confirmar.`);
      toast.success("Dólar actualizado");
    } catch {
      toast.error("No se pudo obtener el dólar. Probá de nuevo.");
    } finally {
      setLoadingUsd(false);
    }
  }

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
          <div className="mb-1 flex items-center justify-between">
            <label className="tj-label" style={{ margin: 0 }}>1 USD equivale a (ARS)</label>
            <button
              type="button"
              onClick={refreshDollar}
              disabled={loadingUsd}
              className="cursor-pointer rounded-[9px] px-2.5 py-1 text-[11px] font-bold"
              style={{ border: "none", background: "rgba(109,94,246,.12)", color: "var(--tj-accent)", opacity: loadingUsd ? 0.6 : 1 }}
            >
              {loadingUsd ? "Actualizando…" : "↻ Actualizar dólar"}
            </button>
          </div>
          <input className="tj-input" value={usd} inputMode="decimal" onChange={(e) => setUsd(e.target.value.replace(/[^\d.,]/g, ""))} />
          {usdHint && <div className="mt-1 text-[11px] font-semibold" style={{ color: "var(--tj-muted)" }}>{usdHint}</div>}
        </div>
        <div className="tj-field">
          <label className="tj-label">1 EUR equivale a (ARS)</label>
          <input className="tj-input" value={eur} inputMode="decimal" onChange={(e) => setEur(e.target.value.replace(/[^\d.,]/g, ""))} />
        </div>
        <button onClick={submit} className="tj-submit mt-2.5">Guardar</button>
      </DialogContent>
    </Dialog>
  );
}
