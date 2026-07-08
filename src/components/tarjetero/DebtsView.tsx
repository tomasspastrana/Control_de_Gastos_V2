"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Debt, FixedExpense, Rates } from "@/lib/types";
import { catColor, fixedMonthly, fmt, fmtCur, hexA, rate } from "@/lib/calc";
import { StatTile } from "./StatTile";
import { ProgressBar } from "./ProgressBar";
import { InstallmentDots } from "./InstallmentDots";
import { PayControls } from "./PayControls";

interface Props {
  debts: Debt[];
  rates: Rates;
  fixedExpenses: FixedExpense[];
  onAddDebt: () => void;
  onPayDebtDelta: (id: string, delta: number) => void;
  onDeleteDebt: (id: string) => void;
  onAddFixed: () => void;
  onEditFixed: (f: FixedExpense) => void;
  onToggleFixed: (f: FixedExpense) => void;
  onDeleteFixed: (id: string) => void;
}

export function DebtsView({ debts, rates, fixedExpenses, onAddDebt, onPayDebtDelta, onDeleteDebt, onAddFixed, onEditFixed, onToggleFixed, onDeleteFixed }: Props) {
  const total = debts.reduce((s, d) => {
    const tot = d.amount * rate(rates, d.currency);
    return s + (tot * (d.installments - d.paidInstallments)) / (d.installments || 1);
  }, 0);
  // sum of one installment per debt that still owes ("cuota de este mes")
  const monthlyInstallments = debts.reduce((s, d) => {
    if (d.paidInstallments >= d.installments) return s;
    const tot = d.amount * rate(rates, d.currency);
    return s + tot / (d.installments || 1);
  }, 0);
  // fixed expenses shown here are the standalone ones (not charged to a card)
  const standaloneFixed = fixedExpenses.filter((f) => f.cardId === null);
  const fixedTotal = fixedMonthly(standaloneFixed, rates);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)", letterSpacing: ".02em" }}>Registro independiente</div>
          <h1 className="mt-0.5 mb-0 text-[28px] font-extrabold tracking-tight">Deudas personales</h1>
        </div>
        <button onClick={onAddDebt} className="tj-cta cursor-pointer rounded-[13px] border-none px-[17px] py-[11px] text-[12.5px] font-bold text-white" style={{ background: "var(--tj-grad)", boxShadow: "0 8px 18px rgba(109,94,246,.32)" }}>
          + Agregar deuda
        </button>
      </div>
      <div className="mb-[22px] max-w-[560px] text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
        Préstamos y deudas de palabra que no pertenecen a ninguna tarjeta (ej: un préstamo de un familiar). No afectan el límite ni las métricas de tus tarjetas.
      </div>

      <div className="mb-[26px] grid max-w-[1160px] gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <StatTile label="Total adeudado (ARS)" value={fmt(total)} valueColor="var(--tj-debt)" big />
        <StatTile label="Cuotas del mes (ARS)" value={fmt(monthlyInstallments)} valueColor="var(--tj-debt)" big />
        <StatTile label="Deudas activas" value={debts.length} big />
        <StatTile label="Gastos fijos · por mes" value={fmt(fixedTotal)} valueColor="var(--tj-debt)" big />
      </div>

      {debts.length > 0 ? (
        <div className="grid max-w-[1040px] gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
          <AnimatePresence initial={false}>
            {debts.map((d) => {
              const tot = d.amount * rate(rates, d.currency);
              const per = tot / (d.installments || 1);
              const rem = (tot * (d.installments - d.paidInstallments)) / d.installments;
              const sub = (d.note ? d.note + " · " : "") + `${fmtCur(per, "ARS")}/cuota`;
              return (
                <motion.div
                  key={d.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  className="tj-glass-soft"
                  style={{ padding: 20, borderRadius: 22 }}
                >
                  <div className="mb-3.5 flex items-start gap-[13px]">
                    <span className="flex items-center justify-center text-lg" style={{ width: 40, height: 40, borderRadius: 13, flex: "none", background: "var(--tj-grad)" }}>🤝</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15.5px] font-extrabold tracking-tight">{d.creditor}</div>
                      <div className="mt-px text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>{sub}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(tot)}</div>
                      <div className="text-[11px] font-semibold" style={{ color: "var(--tj-muted)" }}>{fmtCur(d.amount, d.currency)}</div>
                    </div>
                  </div>

                  <InstallmentDots installments={d.installments} paid={d.paidInstallments} />

                  <div className="mb-3">
                    <ProgressBar pct={d.paidInstallments / d.installments} height={6} track="rgba(0,0,0,.06)" />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="text-[11.5px] font-bold" style={{ color: "var(--tj-muted-2)" }}>
                      {d.paidInstallments}/{d.installments} cuotas · <span className="font-semibold" style={{ color: "var(--tj-muted)" }}>resta {fmt(rem)}</span>
                    </div>
                    <PayControls
                      canPay={d.paidInstallments < d.installments}
                      canUnpay={d.paidInstallments > 0}
                      onPay={() => onPayDebtDelta(d.id, 1)}
                      onUnpay={() => onPayDebtDelta(d.id, -1)}
                      onDelete={() => onDeleteDebt(d.id)}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="max-w-[640px] rounded-[22px] px-5 py-14 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
          Todavía no registraste ninguna deuda personal.
          <br />
          Tocá <b style={{ color: "var(--tj-accent)" }}>+ Agregar deuda</b> para empezar.
        </div>
      )}

      {/* standalone fixed expenses (no card) */}
      <div className="mt-9 mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="mt-0.5 mb-0 text-[22px] font-extrabold tracking-tight">Gastos fijos mensuales</h2>
          <div className="mt-1 max-w-[560px] text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
            Suscripciones y cargos recurrentes sin tarjeta (ej: obra social). Los que van con tarjeta se cargan desde el detalle de esa tarjeta.
          </div>
        </div>
        <button onClick={onAddFixed} className="tj-cta cursor-pointer rounded-[13px] border-none px-[17px] py-[11px] text-[12.5px] font-bold text-white" style={{ background: "var(--tj-grad)", boxShadow: "0 8px 18px rgba(109,94,246,.32)" }}>
          + Gasto fijo
        </button>
      </div>

      {standaloneFixed.length > 0 ? (
        <div className="grid max-w-[1040px] gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
          <AnimatePresence initial={false}>
            {standaloneFixed.map((fx) => {
              const per = fx.amount * rate(rates, fx.currency);
              return (
                <motion.div
                  key={fx.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                  className="tj-glass-soft"
                  style={{ padding: 18, borderRadius: 20, opacity: fx.active ? 1 : 0.55 }}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex items-center justify-center text-base" style={{ width: 36, height: 36, borderRadius: 12, flex: "none", background: hexA(catColor(fx.category), 0.16) }}>🔁</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-extrabold tracking-tight">{fx.name}{!fx.active && <span className="ml-2 text-[11px] font-bold" style={{ color: "var(--tj-muted)" }}>· pausado</span>}</div>
                      <div className="mt-px text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>{fx.category} · {fmtCur(fx.amount, fx.currency)}/mes</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(per)}</div>
                      <div className="text-[10.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>por mes</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onEditFixed(fx)} className="flex-1 cursor-pointer rounded-[10px] px-3 py-[7px] text-[11.5px] font-bold" style={{ border: "1px solid rgba(0,0,0,.12)", background: "transparent", color: "var(--tj-muted-2)" }}>Editar</button>
                    <button onClick={() => onToggleFixed(fx)} className="flex-1 cursor-pointer rounded-[10px] px-3 py-[7px] text-[11.5px] font-bold" style={{ border: "1px solid rgba(0,0,0,.12)", background: "transparent", color: "var(--tj-muted-2)" }}>{fx.active ? "Pausar" : "Activar"}</button>
                    <button onClick={() => onDeleteFixed(fx.id)} className="cursor-pointer rounded-[10px] px-3 py-[7px] text-[11.5px] font-bold" style={{ border: "none", background: "rgba(214,69,90,.08)", color: "var(--tj-danger)" }}>Eliminar</button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="max-w-[640px] rounded-[22px] px-5 py-12 text-center text-sm font-semibold" style={{ background: "rgba(255,255,255,.5)", border: "1px dashed rgba(109,94,246,.3)", color: "#9a96b6" }}>
          Sin gastos fijos independientes todavía.
          <br />
          Tocá <b style={{ color: "var(--tj-accent)" }}>+ Gasto fijo</b> para sumar una suscripción.
        </div>
      )}
    </motion.div>
  );
}
