// Zod schemas — shared validation for forms (client) and, later, server actions (Fase 5).
import { z } from "zod";

export const currencyEnum = z.enum(["ARS", "USD", "EUR"]);
export const brandEnum = z.enum(["visa", "mastercard"]);
export const themeEnum = z.enum(["violet", "coral", "ocean", "teal", "rose", "noir"]);

/** Normalize a human-typed amount to a parseable number-string.
 *  Tolerates AR formatting ("1.234,56" → "1234.56") and plain ("1234.56" stays). */
export function normalizeAmount(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t) return v;
  // if there's a decimal comma, dots are thousands separators; otherwise keep as-is
  return t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
}

/** Parse a typed amount to a number (0 when empty/invalid) — for live previews. */
export function toAmount(v: string): number {
  const n = Number(normalizeAmount(v));
  return Number.isFinite(n) ? n : 0;
}

const positiveAmount = (msg: string) =>
  z.preprocess(normalizeAmount, z.coerce.number().positive(msg));

// closing-rule fields (flat, shared by card create + closing update)
const closingFields = {
  issuer: z.string().trim().nullish(),
  closingRuleType: z.enum(["fixed_day", "weekday_cycle"]).nullish(),
  closingDay: z.coerce.number().int().min(1).max(31).nullish(),
  closingBusinessAdjust: z.boolean().optional(),
  closingAnchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  closingNextGap: z.coerce.number().int().nullish(),
  dueDays: z.coerce.number().int().min(0).max(90).nullish(),
};

export const cardSchema = z.object({
  nickname: z.string().trim().min(1, "Poné un nombre para la tarjeta"),
  holder: z.string().trim().default(""),
  brand: brandEnum,
  last4: z
    .string()
    .transform((s) => s.replace(/\D/g, "").slice(0, 4))
    .default(""),
  expiry: z.string().trim().default(""),
  limit: positiveAmount("El límite debe ser mayor a 0"),
  limitCurrency: currencyEnum,
  theme: themeEnum,
  ...closingFields,
});
export type CardInput = z.input<typeof cardSchema>;

/** Validates a closing-rule update (with cross-field requirements). */
export const closingConfigSchema = z
  .object(closingFields)
  .superRefine((v, ctx) => {
    if (v.closingRuleType === "fixed_day" && v.closingDay == null)
      ctx.addIssue({ code: "custom", message: "Falta el día de cierre", path: ["closingDay"] });
    if (
      v.closingRuleType === "weekday_cycle" &&
      (!v.closingAnchor || (v.closingNextGap !== 28 && v.closingNextGap !== 35))
    )
      ctx.addIssue({ code: "custom", message: "Faltan las dos fechas de cierre", path: ["closingAnchor"] });
  });

export const purchaseSchema = z
  .object({
    cardId: z.string().min(1, "Elegí una tarjeta"),
    merchant: z.string().trim().default(""),
    amount: positiveAmount("El monto debe ser mayor a 0"),
    currency: currencyEnum,
    installments: z.coerce.number().int().min(1).catch(1),
    paidInstallments: z.coerce.number().int().min(0).catch(0),
    category: z.string().min(1),
    date: z.string().min(1),
  })
  .transform((v) => ({
    ...v,
    paidInstallments: Math.min(v.paidInstallments, v.installments),
  }));
export type PurchaseInput = z.input<typeof purchaseSchema>;

export const debtSchema = z
  .object({
    creditor: z.string().trim().min(1, "Poné a quién le debés"),
    note: z.string().trim().default(""),
    amount: positiveAmount("El monto debe ser mayor a 0"),
    currency: currencyEnum,
    installments: z.coerce.number().int().min(1).catch(1),
    paidInstallments: z.coerce.number().int().min(0).catch(0),
  })
  .transform((v) => ({
    ...v,
    paidInstallments: Math.min(v.paidInstallments, v.installments),
  }));
export type DebtInput = z.input<typeof debtSchema>;

export const fixedExpenseSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre para el gasto"),
  amount: positiveAmount("El monto debe ser mayor a 0"),
  currency: currencyEnum,
  category: z.string().min(1).default("Otros"),
  cardId: z.string().trim().nullish(),
  active: z.boolean().default(true),
});
export type FixedExpenseInput = z.input<typeof fixedExpenseSchema>;

export const ratesSchema = z.object({
  usd: z.preprocess(normalizeAmount, z.coerce.number().min(0)),
  eur: z.preprocess(normalizeAmount, z.coerce.number().min(0)),
});
