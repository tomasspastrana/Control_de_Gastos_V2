"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Debt, Rates } from "@/lib/types";
import { fmt, fmtCur, rate } from "@/lib/calc";
import { StatTile } from "./StatTile";
import { ProgressBar } from "./ProgressBar";
import { InstallmentDots } from "./InstallmentDots";
import { PayControls } from "./PayControls";

interface Props {
  debts: Debt[];
  rates: Rates;
  onAddDebt: () => void;
  onPayDebtDelta: (id: string, delta: number) => void;
  onDeleteDebt: (id: string) => void;
}

export function DebtsView({ debts, rates, onAddDebt, onPayDebtDelta, onDeleteDebt }: Props) {
  const total = debts.reduce((s, d) => {
    const tot = d.amount * rate(rates, d.currency);
    return s + (tot * (d.installments - d.paidInstallments)) / (d.installments || 1);
  }, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)", letterSpacing: ".02em" }}>Registro independiente</div>
          <h1 className="mt-0.5 mb-0 text-[28px] font-extrabold tracking-tight">Deudas personales</h1>
        </div>
        <button onClick={onAddDebt} className="cursor-pointer rounded-[13px] border-none px-[17px] py-[11px] text-[12.5px] font-bold text-white" style={{ background: "var(--tj-grad)", boxShadow: "0 8px 18px rgba(109,94,246,.32)" }}>
          + Agregar deuda
        </button>
      </div>
      <div className="mb-[22px] max-w-[560px] text-[12.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
        Préstamos y deudas de palabra que no pertenecen a ninguna tarjeta (ej: un préstamo de un familiar). No afectan el límite ni las métricas de tus tarjetas.
      </div>

      <div className="mb-[26px] grid max-w-[640px] gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
        <StatTile label="Total adeudado (ARS)" value={fmt(total)} valueColor="var(--tj-debt)" big />
        <StatTile label="Deudas activas" value={debts.length} big />
      </div>

      {debts.length > 0 ? (
        <div className="grid max-w-[1040px] gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
          <AnimatePresence initial={false}>
            {debts.map((d) => {
              const tot = d.amount * rate(rates, d.currency);
              const rem = (tot * (d.installments - d.paidInstallments)) / d.installments;
              const sub = (d.note ? d.note + " · " : "") + `${d.paidInstallments}/${d.installments} cuotas`;
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
    </motion.div>
  );
}
