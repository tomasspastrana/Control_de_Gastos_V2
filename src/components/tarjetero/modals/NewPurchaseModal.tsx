"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TjSelect } from "../TjSelect";
import { purchaseSchema, toAmount } from "@/lib/schemas";
import { uid } from "@/lib/id";
import { fmt, rate } from "@/lib/calc";
import { currentDueClosing, dueDate, fmtClosing, ruleFromCard } from "@/lib/closing";
import { purchaseNextClosing } from "@/lib/statements";
import { CATEGORIES, CURRENCIES, type Card, type Currency, type Purchase, type Rates } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (purchase: Purchase) => void;
  onUpdate: (id: string, purchase: Purchase) => void;
  cards: Card[];
  /** all purchases — only used to suggest people already used on shared purchases */
  purchases?: Purchase[];
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
  shared: false, // someone else is on this purchase (shared / lent card)
  sharedWith: "",
  myPct: "100",
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
  shared: !!p.sharedWith,
  sharedWith: p.sharedWith ?? "",
  myPct: String(p.sharedWith ? p.myPct : 100),
});

const PCT_CHIPS = [0, 25, 50, 75];

export function NewPurchaseModal({ open, onClose, onCreate, onUpdate, cards, purchases = [], rates, defaultCardId, initial }: Props) {
  const [f, setF] = useState<Form>(emptyForm(defaultCardId));

  useEffect(() => {
    if (open) setF(initial ? formFrom(initial) : emptyForm(defaultCardId));
  }, [open, initial, defaultCardId]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const totalArs = toAmount(f.amount) * rate(rates, f.currency);
  const preview = fmt(totalArs);
  const hasCards = cards.length > 0;
  const isEdit = !!initial;

  // shared purchase: people already used, and the split preview
  const knownPeople = Array.from(new Set(purchases.map((p) => p.sharedWith).filter((s): s is string => !!s))).sort();
  const myPct = Math.min(100, Math.max(0, parseInt(f.myPct || "0", 10) || 0));
  const personLabel = f.sharedWith.trim() || "la otra persona";
  function toggleShared() {
    // turning it on defaults to "not mine at all" (the lent-card case); turning it off resets to mine
    setF((prev) => (prev.shared ? { ...prev, shared: false, sharedWith: "", myPct: "100" } : { ...prev, shared: true, myPct: "0" }));
  }

  // simulator: where the next unpaid cuota actually lands — the statement due now, unless the
  // date entered is after it closed, in which case it waits for the following one.
  const simCard = cards.find((c) => c.id === f.cardId);
  const simRule = simCard ? ruleFromCard(simCard) : null;
  const simInst = Math.max(1, parseInt(f.installments || "1", 10) || 1);
  const simPaid = Math.min(Math.max(0, parseInt(f.paidInstallments || "0", 10) || 0), simInst);
  const simFullyPaid = simPaid >= simInst;
  const simAnchor = simRule ? currentDueClosing(simRule, new Date(), simCard?.lastPaymentAt ?? null, simCard?.createdAt ?? null) : null;
  const simDateOk = /^\d{4}-\d{2}-\d{2}$/.test(f.date); // the date input is empty mid-edit
  const simClosing =
    simRule && simAnchor ? (simDateOk ? purchaseNextClosing(simRule, { date: f.date }, simAnchor) : simAnchor) : null;
  const simDeferred = !!(simClosing && simAnchor && simClosing > simAnchor);
  const simDue = simClosing && simCard?.dueDays != null ? dueDate(simClosing, simCard.dueDays) : null;

  function submit() {
    if (f.shared && !f.sharedWith.trim()) {
      toast.error("Poné con quién compartís la compra");
      return;
    }
    // the schema normalizes: no sharedWith → mine, 100 %
    const parsed = purchaseSchema.safeParse({ ...f, sharedWith: f.shared ? f.sharedWith : "" });
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
      sharedWith: d.sharedWith,
      myPct: d.myPct,
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

            {/* whose purchase is it: shared card / lent card → only my share counts as my debt */}
            <button
              type="button"
              onClick={toggleShared}
              className="mb-2 flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-[13px] px-[13px] py-[11px] text-[13px] font-bold"
              style={{ border: "1px solid rgba(120,110,180,.22)", background: "rgba(255,255,255,.6)" }}
            >
              <div className="flex w-full items-center justify-between">
                <span>¿De quién es la compra?</span>
                <span style={{ color: f.shared ? "var(--tj-accent)" : "var(--tj-good)" }}>{f.shared ? "Compartida / de otro" : "Mía"}</span>
              </div>
              <span className="text-left" style={{ fontSize: 11, fontWeight: 600, color: "var(--tj-muted)" }}>
                {f.shared
                  ? "Ocupa el límite y viene en el resumen igual, pero en tu deuda cuenta sólo tu parte."
                  : "Tocá si compartís la tarjeta o se la prestaste a alguien."}
              </span>
            </button>
            {f.shared && (
              <div className="mb-2 rounded-[12px] px-3.5 py-2.5" style={{ background: "rgba(109,94,246,.06)", border: "1px solid rgba(109,94,246,.16)" }}>
                <div className="flex gap-3">
                  <div className="tj-field flex-1">
                    <label className="tj-label">Persona</label>
                    <input className="tj-input" list="tj-shared-people" value={f.sharedWith} onChange={(e) => set("sharedWith", e.target.value)} placeholder="Ej: Suegro" />
                    <datalist id="tj-shared-people">
                      {knownPeople.map((n) => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                  <div className="tj-field" style={{ flex: 0.7 }}>
                    <label className="tj-label">Mi parte (%)</label>
                    <input className="tj-input" value={f.myPct} inputMode="numeric" onChange={(e) => set("myPct", e.target.value.replace(/\D/g, "").slice(0, 3))} />
                  </div>
                </div>
                <div className="-mt-1 flex flex-wrap items-center gap-1.5">
                  {PCT_CHIPS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set("myPct", String(n))}
                      className="cursor-pointer rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                      style={{
                        border: myPct === n ? "1.5px solid var(--tj-accent)" : "1px solid rgba(120,110,180,.22)",
                        background: myPct === n ? "rgba(109,94,246,.12)" : "rgba(255,255,255,.7)",
                        color: myPct === n ? "var(--tj-accent)" : "var(--tj-muted-2)",
                      }}
                    >
                      {n === 0 ? "Nada mío" : `${n} % mío`}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-[11.5px] font-bold" style={{ color: "var(--tj-accent)" }}>
                  Vos: {fmt(totalArs * (myPct / 100))} · {personLabel}: {fmt(totalArs * (1 - myPct / 100))}
                </div>
              </div>
            )}

            {/* simulator: which statement the next cuota lands in, given the date entered */}
            {simCard && (
              simRule ? (
                simFullyPaid ? (
                  <div className="mb-1 text-[11.5px] font-semibold" style={{ color: "var(--tj-good)" }}>
                    ✓ La compra quedaría saldada (todas las cuotas pagadas).
                  </div>
                ) : (
                  <div
                    className="mb-1 rounded-[12px] px-3.5 py-2.5"
                    style={
                      simDeferred
                        ? { background: "rgba(232,185,78,.12)", border: "1px solid rgba(232,185,78,.32)" }
                        : { background: "rgba(109,94,246,.08)", border: "1px solid rgba(109,94,246,.18)" }
                    }
                  >
                    <div className="text-[12px] font-bold" style={{ color: simDeferred ? "#a9791f" : "var(--tj-accent)" }}>
                      {simDeferred ? (
                        <>⏳ La compra es posterior al último cierre: la cuota #{simPaid + 1}/{simInst} entra recién al resumen que cierra el {simClosing && fmtClosing(simClosing)}</>
                      ) : (
                        <>🧾 La próxima cuota (#{simPaid + 1}/{simInst}) entra al resumen actual{simClosing && <> que cierra el {fmtClosing(simClosing)}</>}</>
                      )}
                    </div>
                    {simDue && (
                      <div className="mt-0.5 text-[11.5px] font-semibold" style={{ color: "var(--tj-muted)" }}>
                        Esa cuota vence el {fmtClosing(simDue)}
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
