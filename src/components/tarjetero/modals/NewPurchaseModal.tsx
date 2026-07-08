"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { purchaseSchema, toAmount } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { fmt, rate } from "@/lib/calc";
import { fmtClosing, installmentStatement, nextClosing, parseYmd, ruleFromCard } from "@/lib/closing";
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

  // simulator: which statement this purchase's next pending installment falls into
  const simCard = cards.find((c) => c.id === f.cardId);
  const simRule = simCard ? ruleFromCard(simCard) : null;
  const simInst = Math.max(1, parseInt(f.installments || "1", 10) || 1);
  const simPaid = Math.min(Math.max(0, parseInt(f.paidInstallments || "0", 10) || 0), simInst - 1);
  const sim = simRule && f.date ? installmentStatement(simRule, parseYmd(f.date), simPaid, simCard?.dueDays ?? null) : null;
  const isFresh = simPaid === 0;
  // rolled = a fresh purchase whose first statement is later than the current open one
  const rolled = isFresh && !!(simRule && sim && sim.closing.getTime() > nextClosing(simRule).getTime());

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

            {/* simulator: statement this purchase lands in */}
            {simCard && (
              sim ? (
                <div className="mb-1 rounded-[12px] px-3.5 py-2.5" style={{ background: "rgba(109,94,246,.08)", border: "1px solid rgba(109,94,246,.18)" }}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold" style={{ color: "var(--tj-accent)" }}>
                    <span>🧾 {isFresh ? "Entra al" : `Próxima cuota (#${simPaid + 1}) en el`} resumen que cierra el {fmtClosing(sim.closing)}</span>
                    {rolled && <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: "rgba(232,185,78,.2)", color: "#a9791f" }}>próximo resumen</span>}
                  </div>
                  {sim.due && (
                    <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                      {isFresh ? "La primera cuota vence" : "Esa cuota vence"} el {fmtClosing(sim.due)}
                    </div>
                  )}
                </div>
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
