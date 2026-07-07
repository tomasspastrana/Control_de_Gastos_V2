"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { Card, Purchase, Rates } from "@/lib/types";
import { cardMetrics, catColor, fmt, fmtCur, fmtDate, hexA, purchaseInstallment, rate } from "@/lib/calc";
import { updateCardClosing } from "@/app/actions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCardVisual } from "./CreditCardVisual";
import { ProgressBar } from "./ProgressBar";
import { InstallmentDots } from "./InstallmentDots";
import { PayControls } from "./PayControls";
import { ClosingInfo } from "./ClosingInfo";
import { ClosingFields, buildClosingPayload, formFromCard, type ClosingForm } from "./ClosingFields";

interface Props {
  card: Card;
  purchases: Purchase[];
  rates: Rates;
  onBack: () => void;
  onAddPurchase: () => void;
  onDeleteCard: () => void;
  onPayAll: () => void;
  onPayDelta: (id: string, delta: number) => void;
  onDeletePurchase: (id: string) => void;
}

export function CardDetail({ card, purchases, rates, onBack, onAddPurchase, onDeleteCard, onPayAll, onPayDelta, onDeletePurchase }: Props) {
  const m = cardMetrics(card, purchases, rates);
  const ps = purchases.filter((p) => p.cardId === card.id);

  const [closingOpen, setClosingOpen] = useState(false);
  const [closingForm, setClosingForm] = useState<ClosingForm>(formFromCard(card));
  const [saving, setSaving] = useState(false);

  function openClosing() {
    setClosingForm(formFromCard(card));
    setClosingOpen(true);
  }
  async function saveClosing() {
    setSaving(true);
    try {
      await updateCardClosing(card.id, buildClosingPayload(closingForm));
      toast.success("Ciclo de cierre actualizado");
      setClosingOpen(false);
    } catch {
      toast.error("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
      <button onClick={onBack} className="mb-5 inline-flex cursor-pointer items-center gap-[7px] rounded-xl border-none px-3.5 py-2 text-[12.5px] font-bold" style={{ background: "rgba(255,255,255,.5)", color: "var(--tj-debt)" }}>
        ← Volver al inicio
      </button>

      <div className="tj-detailgrid grid items-start gap-7" style={{ gridTemplateColumns: "minmax(0,340px) 1fr" }}>
        {/* left column */}
        <div className="flex flex-col gap-[18px]" style={{ position: "sticky", top: 20 }}>
          <CreditCardVisual card={card} height={210} large />

          <div className="tj-glass" style={{ padding: "18px 20px", borderRadius: 22 }}>
            <Row label="Límite" value={fmt(m.limit)} />
            <Row label="Deuda" value={fmt(m.debt)} valueColor="var(--tj-debt)" />
            <Row label="Disponible" value={fmt(m.avail)} valueColor="var(--tj-good)" mb={14} />
            <ProgressBar pct={m.pct} height={8} />
            <div className="mt-1.5 text-right text-[11px] font-semibold" style={{ color: "var(--tj-muted)" }}>
              {Math.round(m.pct * 100)}% del límite usado
            </div>

            <div style={{ borderTop: "1px solid rgba(120,110,180,.16)", marginTop: 14, paddingTop: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              {card.closingRuleType ? (
                <ClosingInfo card={card} />
              ) : (
                <div className="text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>Configurá el ciclo de cierre</div>
              )}
              <button onClick={openClosing} className="tj-cta shrink-0 cursor-pointer rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-bold" style={{ background: "rgba(109,94,246,.12)", color: "var(--tj-accent)", border: "none" }}>
                Ajustar cierre
              </button>
            </div>
          </div>

          {m.monthly > 0.5 && (
            <button onClick={onPayAll} className="flex cursor-pointer items-center justify-center gap-2 rounded-[15px] border-none p-[13px] text-[13.5px] font-extrabold text-white" style={{ background: "#1c1c22", boxShadow: "0 10px 24px rgba(28,28,34,.28)" }}>
              ✓ Pagar tarjeta · {fmt(m.monthly)}
            </button>
          )}
          <button onClick={onDeleteCard} className="cursor-pointer rounded-[14px] p-[11px] text-[12.5px] font-bold" style={{ border: "1px solid rgba(214,69,90,.3)", background: "rgba(214,69,90,.06)", color: "var(--tj-danger)" }}>
            Eliminar tarjeta
          </button>
        </div>

        {/* right column: purchases */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 text-[19px] font-extrabold tracking-tight">Compras · {card.nickname}</h2>
            <button onClick={onAddPurchase} className="tj-cta cursor-pointer rounded-[13px] border-none px-4 py-2.5 text-[12.5px] font-bold text-white" style={{ background: "var(--tj-grad)", boxShadow: "0 8px 18px rgba(109,94,246,.32)" }}>
              + Cargar compra
            </button>
          </div>

          {ps.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              <AnimatePresence initial={false}>
                {ps.map((p) => {
                  const tot = p.amount * rate(rates, p.currency);
                  const per = purchaseInstallment(p, rates);
                  const rem = (tot * (p.installments - p.paidInstallments)) / p.installments;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                      className="tj-glass-soft"
                      style={{ padding: "18px 20px", borderRadius: 20 }}
                    >
                      <div className="mb-3.5 flex items-start gap-[13px]">
                        <span style={{ width: 34, height: 34, borderRadius: 11, flex: "none", background: hexA(catColor(p.category), 0.16), display: "flex", alignItems: "center", justifyContent: "center" }} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-extrabold tracking-tight">{p.merchant}</div>
                          <div className="mt-px text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                            {p.category} · {fmtDate(p.date)} · {fmtCur(per, "ARS")}/cuota
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(tot)}</div>
                          <div className="text-[11px] font-semibold" style={{ color: "var(--tj-muted)" }}>{fmtCur(p.amount, p.currency)}</div>
                        </div>
                      </div>

                      <InstallmentDots installments={p.installments} paid={p.paidInstallments} />

                      <div className="mb-3">
                        <ProgressBar pct={p.paidInstallments / p.installments} height={6} track="rgba(0,0,0,.06)" />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2.5">
                        <div className="text-[11.5px] font-bold" style={{ color: "var(--tj-muted-2)" }}>
                          {p.paidInstallments}/{p.installments} cuotas · <span className="font-semibold" style={{ color: "var(--tj-muted)" }}>resta {fmt(rem)}</span>
                        </div>
                        <PayControls
                          canPay={p.paidInstallments < p.installments}
                          canUnpay={p.paidInstallments > 0}
                          onPay={() => onPayDelta(p.id, 1)}
                          onUnpay={() => onPayDelta(p.id, -1)}
                          onDelete={() => onDeletePurchase(p.id)}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="rounded-[20px] px-5 py-[50px] text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
              Todavía no hay compras en esta tarjeta.
              <br />
              Tocá <b style={{ color: "var(--tj-accent)" }}>+ Cargar compra</b> para empezar.
            </div>
          )}
        </div>
      </div>

      <Dialog open={closingOpen} onOpenChange={(o) => !o && setClosingOpen(false)}>
        <DialogContent className="tj-modal">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-tight">Ciclo de cierre · {card.nickname}</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <ClosingFields form={closingForm} setForm={setClosingForm} />
          </div>
          <button onClick={saveClosing} disabled={saving} className="tj-submit">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Row({ label, value, valueColor, mb = 12 }: { label: string; value: string; valueColor?: string; mb?: number }) {
  return (
    <div className="flex justify-between" style={{ marginBottom: mb }}>
      <span className="text-xs font-semibold" style={{ color: "var(--tj-muted)" }}>{label}</span>
      <span className="text-[13.5px] font-extrabold" style={{ color: valueColor, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
