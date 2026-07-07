"use client";

import { addDays, deriveWeekdayCycle, parseYmd, ymd } from "@/lib/closing";
import type { Card } from "@/lib/types";
import { TjSelect } from "./TjSelect";

export interface ClosingForm {
  ruleType: "" | "fixed_day" | "weekday_cycle";
  day: string;
  businessAdjust: boolean;
  lastClose: string; // yyyy-mm-dd
  prevClose: string; // yyyy-mm-dd
  dueDays: string;
}

export const emptyClosingForm = (): ClosingForm => ({
  ruleType: "",
  day: "",
  businessAdjust: false,
  lastClose: "",
  prevClose: "",
  dueDays: "",
});

/** Prefill the form from an existing card (reconstructs the two cycle dates from anchor+gap). */
export function formFromCard(c: Card): ClosingForm {
  const f = emptyClosingForm();
  f.ruleType = (c.closingRuleType as ClosingForm["ruleType"]) || "";
  f.businessAdjust = !!c.closingBusinessAdjust;
  f.day = c.closingDay != null ? String(c.closingDay) : "";
  f.dueDays = c.dueDays != null ? String(c.dueDays) : "";
  if (c.closingRuleType === "weekday_cycle" && c.closingAnchor && c.closingNextGap) {
    const prevGap = c.closingNextGap === 28 ? 35 : 28;
    f.lastClose = c.closingAnchor;
    f.prevClose = ymd(addDays(parseYmd(c.closingAnchor), -prevGap));
  }
  return f;
}

/** Normalized flat closing columns from the form (null when not configured / incomplete). */
export function buildClosingPayload(f: ClosingForm) {
  const empty = {
    closingRuleType: null as "fixed_day" | "weekday_cycle" | null,
    closingDay: null as number | null,
    closingBusinessAdjust: false,
    closingAnchor: null as string | null,
    closingNextGap: null as number | null,
    dueDays: f.dueDays ? parseInt(f.dueDays, 10) : null,
  };
  if (f.ruleType === "fixed_day" && f.day) {
    return { ...empty, closingRuleType: "fixed_day" as const, closingDay: parseInt(f.day, 10), closingBusinessAdjust: f.businessAdjust };
  }
  if (f.ruleType === "weekday_cycle" && f.lastClose && f.prevClose) {
    const [a, b] = [f.prevClose, f.lastClose].sort();
    const { anchor, nextGap } = deriveWeekdayCycle(a, b);
    return { ...empty, closingRuleType: "weekday_cycle" as const, closingAnchor: anchor, closingNextGap: nextGap };
  }
  return { ...empty, closingRuleType: null };
}

const RULE_OPTIONS = [
  { value: "", label: "Sin configurar" },
  { value: "fixed_day", label: "Día fijo del mes" },
  { value: "weekday_cycle", label: "Día de semana (ciclo)" },
];

export function ClosingFields({ form, setForm }: { form: ClosingForm; setForm: (f: ClosingForm) => void }) {
  const set = <K extends keyof ClosingForm>(k: K, v: ClosingForm[K]) => setForm({ ...form, [k]: v });

  return (
    <div>
      <label className="tj-label">Ciclo de facturación (opcional)</label>
      <TjSelect
        value={form.ruleType}
        onChange={(v) => set("ruleType", v as ClosingForm["ruleType"])}
        options={RULE_OPTIONS}
      />

      {form.ruleType === "fixed_day" && (
        <div className="mt-3">
          <div className="flex gap-3">
            <div className="tj-field flex-1">
              <label className="tj-label">Día de cierre</label>
              <input className="tj-input" value={form.day} inputMode="numeric" placeholder="30" onChange={(e) => set("day", e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </div>
            <div className="tj-field flex-1">
              <label className="tj-label">Vence a los (días)</label>
              <input className="tj-input" value={form.dueDays} inputMode="numeric" placeholder="10" onChange={(e) => set("dueDays", e.target.value.replace(/\D/g, "").slice(0, 2))} />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--tj-muted-2)" }}>
            <input type="checkbox" checked={form.businessAdjust} onChange={(e) => set("businessAdjust", e.target.checked)} />
            Si cae finde/feriado, mover al día hábil anterior (ej. Ualá)
          </label>
        </div>
      )}

      {form.ruleType === "weekday_cycle" && (
        <div className="mt-3">
          <div className="mb-2 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
            Cargá las <b>dos últimas fechas de cierre</b> de tus resúmenes (BBVA/Patagonia cierran siempre el mismo día de semana).
          </div>
          <div className="flex gap-3">
            <div className="tj-field flex-1">
              <label className="tj-label">Cierre anterior</label>
              <input type="date" className="tj-input" value={form.prevClose} onChange={(e) => set("prevClose", e.target.value)} />
            </div>
            <div className="tj-field flex-1">
              <label className="tj-label">Último cierre</label>
              <input type="date" className="tj-input" value={form.lastClose} onChange={(e) => set("lastClose", e.target.value)} />
            </div>
          </div>
          <div className="tj-field">
            <label className="tj-label">Vence a los (días corridos)</label>
            <input className="tj-input" value={form.dueDays} inputMode="numeric" placeholder="11" onChange={(e) => set("dueDays", e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </div>
        </div>
      )}
    </div>
  );
}
