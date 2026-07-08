"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import type { Card, FixedExpense, Purchase, Rates } from "@/lib/types";
import { cardMetrics, catColor, fmt, fmtCur, fmtDate, hexA, purchaseInstallment, rate } from "@/lib/calc";
import { fmtClosing, installmentStatement, parseYmd, paymentAlert, ruleFromCard } from "@/lib/closing";
import { currentStatement } from "@/lib/statements";
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
  fixedExpenses: FixedExpense[];
  onBack: () => void;
  onAddPurchase: () => void;
  onDeleteCard: () => void;
  onPayAll: (ids: string[]) => void;
  onPayDelta: (id: string, delta: number) => void;
  onDeletePurchase: (id: string) => void;
  onEditPurchase: (p: Purchase) => void;
  onAddFixed: () => void;
  onEditFixed: (f: FixedExpense) => void;
  onToggleFixed: (f: FixedExpense) => void;
  onDeleteFixed: (id: string) => void;
}

export function CardDetail({ card, purchases, rates, fixedExpenses, onBack, onAddPurchase, onDeleteCard, onPayAll, onPayDelta, onDeletePurchase, onEditPurchase, onAddFixed, onEditFixed, onToggleFixed, onDeleteFixed }: Props) {
  const m = cardMetrics(card, purchases, rates, fixedExpenses);
  const ps = purchases.filter((p) => p.cardId === card.id);
  const cardFixed = fixedExpenses.filter((f) => f.cardId === card.id);

  const rule = ruleFromCard(card);
  const alert = rule ? paymentAlert(rule, card.dueDays ?? null, m.debt > 0.5, card.lastPaymentAt ?? null) : null;
  // "Pagar tarjeta" = this month's statement (matches the Resúmenes total exactly)
  const stmt = currentStatement(card, purchases, fixedExpenses, rates);
  const payIds = stmt.items.filter((i) => i.purchaseId).map((i) => i.purchaseId!);

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

      {alert && (
        <div
          className="mb-5 flex items-center gap-3 rounded-[16px] px-4 py-3.5"
          style={{
            border: `1px solid ${alert.level === "overdue" ? "rgba(214,69,90,.35)" : "rgba(232,185,78,.4)"}`,
            background: alert.level === "overdue" ? "rgba(214,69,90,.08)" : "rgba(232,185,78,.12)",
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1, flex: "none" }}>{alert.level === "overdue" ? "⚠️" : "⏰"}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-extrabold" style={{ color: alert.level === "overdue" ? "var(--tj-danger)" : "#a9791f" }}>
              {alert.level === "overdue" ? "Pago vencido" : "El pago vence pronto"}
            </div>
            <div className="text-[12px] font-semibold" style={{ color: "var(--tj-muted-2)" }}>
              {alert.level === "overdue"
                ? `Venció ${fmtClosing(alert.due)} · hace ${-alert.days} ${-alert.days === 1 ? "día" : "días"}`
                : `Vence ${fmtClosing(alert.due)} · ${alert.days === 0 ? "es hoy" : alert.days === 1 ? "es mañana" : `en ${alert.days} días`}`}
            </div>
          </div>
        </div>
      )}

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
                <ClosingInfo card={card} alert={alert?.level ?? null} />
              ) : (
                <div className="text-[12px] font-semibold" style={{ color: "var(--tj-muted)" }}>Configurá el ciclo de cierre</div>
              )}
              <button onClick={openClosing} className="tj-cta shrink-0 cursor-pointer rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-bold" style={{ background: "rgba(109,94,246,.12)", color: "var(--tj-accent)", border: "none" }}>
                Ajustar cierre
              </button>
            </div>
          </div>

          {stmt.total > 0.5 && (
            <button onClick={() => onPayAll(payIds)} className="flex cursor-pointer items-center justify-center gap-2 rounded-[15px] border-none p-[13px] text-[13.5px] font-extrabold text-white" style={{ background: "#1c1c22", boxShadow: "0 10px 24px rgba(28,28,34,.28)" }}>
              ✓ Pagar tarjeta · {fmt(stmt.total)}
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
                  const fullyPaid = p.paidInstallments >= p.installments;
                  // statement of the next PENDING installment (not the first one)
                  const stmt = rule ? installmentStatement(rule, parseYmd(p.date), Math.min(p.paidInstallments, p.installments - 1), card.dueDays ?? null) : null;
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
                          {stmt && (
                            <div className="mt-1 inline-flex flex-wrap items-center gap-1 text-[11px] font-semibold" style={{ color: fullyPaid ? "var(--tj-good)" : "var(--tj-accent)" }}>
                              {fullyPaid ? (
                                <><span aria-hidden>✓</span> Cuotas saldadas</>
                              ) : (
                                <>
                                  <span aria-hidden>🧾</span> Cuota {p.paidInstallments + 1}/{p.installments} · resumen cierra {fmtClosing(stmt.closing)}
                                  {stmt.due && <span style={{ color: "var(--tj-muted)" }}>· vence {fmtClosing(stmt.due)}</span>}
                                </>
                              )}
                            </div>
                          )}
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
                          onEdit={() => onEditPurchase(p)}
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

          {/* fixed expenses charged to this card */}
          <div className="mt-7 mb-3 flex items-center justify-between">
            <div>
              <h2 className="m-0 text-[19px] font-extrabold tracking-tight">Gastos fijos</h2>
              <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>Cargos mensuales recurrentes que ocupan el límite de esta tarjeta.</div>
            </div>
            <button onClick={onAddFixed} className="tj-cta shrink-0 cursor-pointer rounded-[13px] border-none px-4 py-2.5 text-[12.5px] font-bold" style={{ background: "rgba(109,94,246,.12)", color: "var(--tj-accent)" }}>
              + Gasto fijo
            </button>
          </div>

          {cardFixed.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {cardFixed.map((fx) => {
                const per = fx.amount * rate(rates, fx.currency);
                return (
                  <div key={fx.id} className="tj-glass-soft flex flex-wrap items-center gap-x-4 gap-y-2.5" style={{ padding: "14px 18px", borderRadius: 16, opacity: fx.active ? 1 : 0.55 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 10, flex: "none", background: hexA(catColor(fx.category), 0.16) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-extrabold tracking-tight">{fx.name}</span>
                        {!fx.occupiesLimit && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(120,110,180,.14)", color: "var(--tj-muted-2)" }}>no ocupa límite</span>}
                        {!fx.active && <span className="text-[11px] font-bold" style={{ color: "var(--tj-muted)" }}>· pausado</span>}
                      </div>
                      <div className="mt-px text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>{fx.category} · {fmtCur(fx.amount, fx.currency)}/mes</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[15px] font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(per)}</div>
                      <div className="text-[10.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>por mes</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onEditFixed(fx)} className="cursor-pointer rounded-[10px] px-3 py-[7px] text-[11.5px] font-bold" style={{ border: "1px solid rgba(0,0,0,.12)", background: "transparent", color: "var(--tj-muted-2)" }}>Editar</button>
                      <button onClick={() => onToggleFixed(fx)} className="cursor-pointer rounded-[10px] px-3 py-[7px] text-[11.5px] font-bold" style={{ border: "1px solid rgba(0,0,0,.12)", background: "transparent", color: "var(--tj-muted-2)" }}>{fx.active ? "Pausar" : "Activar"}</button>
                      <button onClick={() => onDeleteFixed(fx.id)} className="cursor-pointer rounded-[10px] px-3 py-[7px] text-[11.5px] font-bold" style={{ border: "none", background: "rgba(214,69,90,.08)", color: "var(--tj-danger)" }}>Eliminar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[16px] px-5 py-7 text-center text-[13px] font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
              Sin gastos fijos en esta tarjeta. Tocá <b style={{ color: "var(--tj-accent)" }}>+ Gasto fijo</b> para sumar una suscripción.
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
