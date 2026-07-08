"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { purchaseSchema, toAmount } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { fmt, rate } from "@/lib/calc";
import { dueDate, fmtClosing, nextClosing, ruleFromCard } from "@/lib/closing";
import { CATEGORIES, CURRENCIES, type Card, type Currency, type Purchase, type Rates } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (purchase: Purchase) => void;
  onUpdate: (id: string, purchase: Purchase) => void;
  cards: Card[];
  rates: Rates;
  defaultCardId: string;
  /** Present = edit mode (prefills the form). */
  initial?: Purchase | null;
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

type Form = ReturnType<typeof emptyForm>;

const formFrom = (p: Purchase): Form => ({
  cardId: p.cardId,
  merchant: p.merchant,
  amount: String(p.amount),
  currency: p.currency,
  installments: String(p.installments),
  paidInstallments: String(p.paidInstallments),
  category: p.category,
  date: p.date,
});

export function NewPurchaseModal({ open, onClose, onCreate, onUpdate, cards, rates, defaultCardId, initial }: Props) {
  const [f, setF] = useState<Form>(emptyForm(defaultCardId));

  useEffect(() => {
    if (open) setF(initial ? formFrom(initial) : emptyForm(defaultCardId));
  }, [open, initial, defaultCardId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const preview = fmt(toAmount(f.amount) * rate(rates, f.currency));
  const hasCards = cards.length > 0;
  const isEdit = !!initial;

  // simulator: the next unpaid cuota lands in the CURRENT statement (next closing from today).
  // The purchase date is informational only — position depends on how many cuotas are paid.
  const simCard = cards.find((c) => c.id === f.cardId);
  const simRule = simCard ? ruleFromCard(simCard) : null;
  const simInst = Math.max(1, parseInt(f.installments || "1", 10) || 1);
  const simPaid = Math.min(Math.max(0, parseInt(f.paidInstallments || "0", 10) || 0), simInst);
  const simFullyPaid = simPaid >= simInst;
  const simClosing = simRule ? nextClosing(simRule) : null;
  const simDue = simClosing && simCard?.dueDays != null ? dueDate(simClosing, simCard.dueDays) : null;

  function submit() {
    const parsed = purchaseSchema.safeParse(f);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    const d = parsed.data;
    const purchase: Purchase = {
      id: initial?.id ?? uid("p"),
      cardId: d.cardId,
      merchant: d.merchant || "Compra",
      amount: d.amount,
      currency: d.currency,
      installments: d.installments,
      paidInstallments: d.paidInstallments,
      category: d.category,
      date: d.date,
    };
    if (isEdit) {
      onUpdate(purchase.id, purchase);
      toast.success("Compra actualizada");
    } else {
      onCreate(purchase);
      toast.success("Compra agregada");
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="tj-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold tracking-tight">{isEdit ? "Editar compra" : "Cargar compra en cuotas"}</DialogTitle>
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

            {/* simulator: the next cuota lands in the current statement (anchored to now) */}
            {simCard && (
              simRule ? (
                simFullyPaid ? (
                  <div className="mb-1 text-[11.5px] font-semibold" style={{ color: "var(--tj-good)" }}>
                    ✓ La compra quedaría saldada (todas las cuotas pagadas).
                  </div>
                ) : (
                  <div className="mb-1 rounded-[12px] px-3.5 py-2.5" style={{ background: "rgba(109,94,246,.08)", border: "1px solid rgba(109,94,246,.18)" }}>
                    <div className="text-[12px] font-bold" style={{ color: "var(--tj-accent)" }}>
                      🧾 La próxima cuota (#{simPaid + 1}/{simInst}) entra al resumen actual{simClosing && <> que cierra el {fmtClosing(simClosing)}</>}
                    </div>
                    {simDue && (
                      <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                        Esa cuota vence el {fmtClosing(simDue)} · la fecha de compra es solo informativa
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="mb-1 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                  Configurá el ciclo de cierre de la tarjeta para simular en qué resumen cae.
                </div>
              )
            )}

            <button onClick={submit} className="tj-submit mt-2">{isEdit ? "Guardar cambios" : "Agregar compra"}</button>
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
