// Catalog of Argentine issuers with a closing-rule preset that pre-fills the card form.
// Only BBVA/Patagonia/Ualá/Sucrédito are *confirmed* from real statements; the rest default to
// "fixed_day" (the common case) with a typical day the user confirms with their own resumen.
// Closing dates are often account-specific and changeable, so presets are starting points.

import type { ClosingRuleType } from "./types";

export interface BankPreset {
  ruleType: ClosingRuleType;
  /** typical closing day for fixed_day (user confirms) */
  day?: number;
  businessAdjust?: boolean;
  dueDays?: number;
}

export interface Bank {
  id: string;
  name: string;
  /** confirmed from a real statement */
  confirmed?: boolean;
  preset?: BankPreset;
}

export const BANKS: Bank[] = [
  // --- confirmed from statements ---
  { id: "bbva", name: "BBVA Francés", confirmed: true, preset: { ruleType: "weekday_cycle", dueDays: 10 } },
  { id: "patagonia", name: "Banco Patagonia", confirmed: true, preset: { ruleType: "weekday_cycle", dueDays: 10 } },
  { id: "uala", name: "Ualá", confirmed: true, preset: { ruleType: "fixed_day", day: 30, businessAdjust: true, dueDays: 8 } },
  { id: "sucredito", name: "Sucrédito", confirmed: true, preset: { ruleType: "fixed_day", day: 23, businessAdjust: false, dueDays: 9 } },
  // --- generic defaults (fixed day, user confirms) ---
  { id: "galicia", name: "Banco Galicia", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "santander", name: "Santander", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "nacion", name: "Banco Nación", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "ciudad", name: "Banco Ciudad", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "macro", name: "Banco Macro", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "supervielle", name: "Supervielle", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 12 } },
  { id: "naranja", name: "Naranja X", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 13 } },
  { id: "brubank", name: "Brubank", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "icbc", name: "ICBC", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "comafi", name: "Banco Comafi", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "credicoop", name: "Banco Credicoop", preset: { ruleType: "fixed_day", businessAdjust: true, dueDays: 10 } },
  { id: "otro", name: "Otro / no configurar" },
];

export function bankById(id: string | null | undefined): Bank | undefined {
  return id ? BANKS.find((b) => b.id === id) : undefined;
}
