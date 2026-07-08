"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { fixedExpenseSchema, toAmount } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { fmt, rate } from "@/lib/calc";
import { CATEGORIES, CURRENCIES, type Card, type Currency, type FixedExpense, type Rates } from "@/lib/types";

const NO_CARD = "none";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (fixed: FixedExpense) => void;
  onUpdate: (id: string, fixed: FixedExpense) => void;
  cards: Card[];
  rates: Rates;
  /** Present = edit mode (prefills the form). */
  initial?: FixedExpense | null;
  /** Preselected card when creating from a card detail. */
  defaultCardId?: string | null;
}

const emptyForm = (cardId: string | null) => ({
  name: "",
  amount: "",
  currency: "ARS" as Currency,
  category: "Servicios" as string,
  cardId: cardId ?? NO_CARD,
  active: true,
  occupiesLimit: true,
});

type Form = ReturnType<typeof emptyForm>;

const formFrom = (f: FixedExpense): Form => ({
  name: f.name,
  amount: String(f.amount),
  currency: f.currency,
  category: f.category,
  cardId: f.cardId ?? NO_CARD,
  active: f.active,
  occupiesLimit: f.occupiesLimit,
});

export function FixedExpenseModal({ open, onClose, onCreate, onUpdate, cards, rates, initial, defaultCardId }: Props) {
  const [f, setF] = useState<Form>(emptyForm(defaultCardId ?? null));

  useEffect(() => {
    if (open) setF(initial ? formFrom(initial) : emptyForm(defaultCardId ?? null));
  }, [open, initial, defaultCardId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  const preview = fmt(toAmount(f.amount) * rate(rates, f.currency));
  const isEdit = !!initial;

  function submit() {
    const cardId = f.cardId === NO_CARD ? null : f.cardId;
    const parsed = fixedExpenseSchema.safeParse({ ...f, cardId });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const d = parsed.data;
    const fixed: FixedExpense = {
      id: initial?.id ?? uid("f"),
      cardId: d.cardId ?? null,
      name: d.name,
      amount: d.amount,
      currency: d.currency,
      category: d.category,
      active: d.active,
      // only meaningful when charged to a card; standalone expenses don't touch any limit
      occupiesLimit: d.cardId ? d.occupiesLimit : true,
    };
    if (isEdit) {
      onUpdate(fixed.id, fixed);
      toast.success("Gasto fijo actualizado");
    } else {
      onCreate(fixed);
      toast.success("Gasto fijo agregado");
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tj-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">
            {isEdit ? "Editar gasto fijo" : "Nuevo gasto fijo"}
          </DialogTitle>
        </DialogHeader>
        <div className="mb-4 text-xs font-semibold" style={{ color: "var(--tj-muted)" }}>
          Cargo mensual recurrente (ej: Netflix, Claude, obra social). Si lo asociás a una tarjeta, ocupa su límite cada mes.
        </div>

        <div className="tj-field">
          <label className="tj-label">Nombre</label>
          <input className="tj-input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej: Netflix" />
        </div>

        <div className="flex gap-3">
          <div className="tj-field" style={{ flex: 1.5 }}>
            <label className="tj-label">Monto por mes</label>
            <input className="tj-input" value={f.amount} inputMode="decimal" onChange={(e) => set("amount", e.target.value.replace(/[^\d.,]/g, ""))} placeholder="20" />
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
          ≈ {preview}/mes en ARS
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
            <label className="tj-label">Tarjeta</label>
            <TjSelect
              value={f.cardId}
              onChange={(v) => set("cardId", v)}
              options={[{ value: NO_CARD, label: "— Sin tarjeta —" }, ...cards.map((c) => ({ value: c.id, label: `${c.nickname} ···${c.last4}` }))]}
            />
          </div>
        </div>

        {f.cardId !== NO_CARD && (
          <button
            type="button"
            onClick={() => set("occupiesLimit", !f.occupiesLimit)}
            className="mb-2 flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-[13px] px-[13px] py-[11px] text-[13px] font-bold"
            style={{ border: "1px solid rgba(120,110,180,.22)", background: "rgba(255,255,255,.6)" }}
          >
            <div className="flex w-full items-center justify-between">
              <span>Ocupa el límite de la tarjeta</span>
              <span style={{ color: f.occupiesLimit ? "var(--tj-good)" : "var(--tj-muted)" }}>{f.occupiesLimit ? "Sí" : "No"}</span>
            </div>
            <span className="text-left" style={{ fontSize: 11, fontWeight: 600, color: "var(--tj-muted)" }}>
              {f.occupiesLimit ? "Reduce el disponible y suma a la deuda (suscripciones, impuestos)." : "Comisión de mantenimiento: se paga cada mes pero no reduce el disponible."}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => set("active", !f.active)}
          className="mb-1 flex w-full cursor-pointer items-center justify-between rounded-[13px] px-[13px] py-[11px] text-[13px] font-bold"
          style={{ border: "1px solid rgba(120,110,180,.22)", background: "rgba(255,255,255,.6)", color: f.active ? "var(--tj-good)" : "var(--tj-muted)" }}
        >
          <span>{f.active ? "Activo" : "Pausado"}</span>
          <span style={{ fontSize: 11, color: "var(--tj-muted)" }}>{f.active ? "cuenta en el total mensual" : "no suma al total"}</span>
        </button>

        <button onClick={submit} className="tj-submit mt-2">{isEdit ? "Guardar cambios" : "Agregar gasto fijo"}</button>
      </DialogContent>
    </Dialog>
  );
}
