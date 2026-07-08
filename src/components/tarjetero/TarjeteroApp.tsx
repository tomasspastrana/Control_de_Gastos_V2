"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Toaster } from "@/components/ui/sonner";
import { reducer, type Action } from "@/lib/store";
import { THEMES, type AppData, type Card, type Debt, type FixedExpense, type Purchase, type Rates } from "@/lib/types";
import * as actions from "@/app/actions";
import { AppShell } from "./AppShell";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { CardDetail } from "./CardDetail";
import { DebtsView } from "./DebtsView";
import { StatementsView } from "./StatementsView";
import { NewCardModal } from "./modals/NewCardModal";
import { NewPurchaseModal } from "./modals/NewPurchaseModal";
import { SettingsModal } from "./modals/SettingsModal";
import { NewDebtModal } from "./modals/NewDebtModal";
import { FixedExpenseModal } from "./modals/FixedExpenseModal";

type View = "dashboard" | "card" | "debts" | "statements";
type Modal = null | "card" | "purchase" | "settings" | "debt" | "fixed";

export function TarjeteroApp({ data, userEmail }: { data: AppData; userEmail: string }) {
  // optimistic overlay on top of the server data, driven by the same pure reducer
  const [optimistic, applyOptimistic] = useOptimistic(data, reducer);
  const [, startTransition] = useTransition();

  const [view, setView] = useState<View>("dashboard");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  // fixed-expense modal context: what we're editing (null = create) and a preselected card
  const [fixedEdit, setFixedEdit] = useState<FixedExpense | null>(null);
  const [fixedCardId, setFixedCardId] = useState<string | null>(null);
  // purchase modal context: what we're editing (null = create)
  const [purchaseEdit, setPurchaseEdit] = useState<Purchase | null>(null);

  // apply optimistically + run the server action inside one transition
  function run(action: Action, serverCall: () => Promise<void>) {
    startTransition(async () => {
      applyOptimistic(action);
      try {
        await serverCall();
      } catch {
        // on failure the revalidated server data replaces the optimistic state
      }
    });
  }

  const selectedCard = optimistic.cards.find((c) => c.id === selectedCardId) ?? null;
  const effectiveView: View = view === "card" && !selectedCard ? "dashboard" : view;

  const openCard = (id: string) => { setSelectedCardId(id); setView("card"); };
  const goHome = () => { setView("dashboard"); setSelectedCardId(null); };
  const goDebts = () => { setView("debts"); setSelectedCardId(null); };
  const goStatements = () => { setView("statements"); setSelectedCardId(null); };

  const defaultPurchaseCardId = selectedCardId ?? optimistic.cards[0]?.id ?? "";
  const nextTheme = THEMES[optimistic.cards.length % THEMES.length];
  const userName = (userEmail.split("@")[0] || "").replace(/^\w/, (c) => c.toUpperCase());

  // domain handlers
  const createCard = (card: Card) => run({ type: "ADD_CARD", card }, () => actions.createCard(card));
  const deleteCard = (id: string) => {
    run({ type: "DELETE_CARD", id }, () => actions.deleteCard(id));
    if (selectedCardId === id) goHome();
  };
  const createPurchase = (p: Purchase) => run({ type: "ADD_PURCHASE", purchase: p }, () => actions.createPurchase(p));
  const updatePurchase = (id: string, p: Purchase) => run({ type: "EDIT_PURCHASE", id, patch: p }, () => actions.updatePurchase(id, p));
  const deletePurchase = (id: string) => run({ type: "DELETE_PURCHASE", id }, () => actions.deletePurchase(id));
  const openNewPurchase = () => { setPurchaseEdit(null); setModal("purchase"); };
  const openEditPurchase = (p: Purchase) => { setPurchaseEdit(p); setModal("purchase"); };
  const payDelta = (id: string, delta: number) => run({ type: "PAY_DELTA", id, delta }, () => actions.payPurchaseDelta(id, delta));
  const payCard = (cardId: string, ids: string[]) => run({ type: "PAY_CARD", cardId, at: new Date().toLocaleDateString("en-CA"), ids }, () => actions.payCard(cardId, ids));
  const createDebt = (d: Debt) => run({ type: "ADD_DEBT", debt: d }, () => actions.createDebt(d));
  const deleteDebt = (id: string) => run({ type: "DELETE_DEBT", id }, () => actions.deleteDebt(id));
  const payDebtDelta = (id: string, delta: number) => run({ type: "PAY_DEBT_DELTA", id, delta }, () => actions.payDebtDelta(id, delta));
  const createFixed = (f: FixedExpense) => run({ type: "ADD_FIXED", fixed: f }, () => actions.createFixedExpense(f));
  const updateFixed = (id: string, f: FixedExpense) => run({ type: "EDIT_FIXED", id, patch: f }, () => actions.updateFixedExpense(id, f));
  const deleteFixed = (id: string) => run({ type: "DELETE_FIXED", id }, () => actions.deleteFixedExpense(id));
  const toggleFixed = (f: FixedExpense) => run({ type: "TOGGLE_FIXED", id: f.id }, () => actions.toggleFixedExpense(f.id, !f.active));
  const openNewFixed = (cardId: string | null) => { setFixedEdit(null); setFixedCardId(cardId); setModal("fixed"); };
  const openEditFixed = (f: FixedExpense) => { setFixedEdit(f); setFixedCardId(f.cardId); setModal("fixed"); };
  const saveRates = (rates: Partial<Rates>) =>
    run({ type: "SET_RATES", rates }, () => actions.saveRates({ usd: rates.USD ?? optimistic.rates.USD, eur: rates.EUR ?? optimistic.rates.EUR }));

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            cards={optimistic.cards}
            purchases={optimistic.purchases}
            rates={optimistic.rates}
            fixedExpenses={optimistic.fixedExpenses}
            view={effectiveView}
            selectedCardId={selectedCardId}
            debtsCount={optimistic.debts.length}
            onAddPurchase={openNewPurchase}
            onGoHome={goHome}
            onGoDebts={goDebts}
            onGoStatements={goStatements}
            onAddCard={() => setModal("card")}
            onOpenSettings={() => setModal("settings")}
            onOpenCard={openCard}
            userEmail={userEmail}
          />
        }
      >
        {effectiveView === "dashboard" && (
          <Dashboard
            data={optimistic}
            userName={userName}
            onAddCard={() => setModal("card")}
            onOpenCard={openCard}
            onDeleteCard={deleteCard}
            onGoDebts={goDebts}
          />
        )}

        {effectiveView === "card" && selectedCard && (
          <CardDetail
            key={selectedCard.id}
            card={selectedCard}
            purchases={optimistic.purchases}
            rates={optimistic.rates}
            fixedExpenses={optimistic.fixedExpenses}
            onBack={goHome}
            onAddPurchase={openNewPurchase}
            onDeleteCard={() => deleteCard(selectedCard.id)}
            onPayAll={(ids) => payCard(selectedCard.id, ids)}
            onPayDelta={payDelta}
            onDeletePurchase={deletePurchase}
            onEditPurchase={openEditPurchase}
            onAddFixed={() => openNewFixed(selectedCard.id)}
            onEditFixed={openEditFixed}
            onToggleFixed={toggleFixed}
            onDeleteFixed={deleteFixed}
          />
        )}

        {effectiveView === "statements" && (
          <StatementsView
            cards={optimistic.cards}
            purchases={optimistic.purchases}
            fixedExpenses={optimistic.fixedExpenses}
            rates={optimistic.rates}
            onOpenCard={openCard}
          />
        )}

        {effectiveView === "debts" && (
          <DebtsView
            debts={optimistic.debts}
            rates={optimistic.rates}
            fixedExpenses={optimistic.fixedExpenses}
            onAddDebt={() => setModal("debt")}
            onPayDebtDelta={payDebtDelta}
            onDeleteDebt={deleteDebt}
            onAddFixed={() => openNewFixed(null)}
            onEditFixed={openEditFixed}
            onToggleFixed={toggleFixed}
            onDeleteFixed={deleteFixed}
          />
        )}
      </AppShell>

      <NewCardModal open={modal === "card"} onClose={() => setModal(null)} onCreate={createCard} initialTheme={nextTheme} />
      <NewPurchaseModal open={modal === "purchase"} onClose={() => setModal(null)} onCreate={createPurchase} onUpdate={updatePurchase} cards={optimistic.cards} rates={optimistic.rates} defaultCardId={defaultPurchaseCardId} initial={purchaseEdit} />
      <SettingsModal open={modal === "settings"} onClose={() => setModal(null)} rates={optimistic.rates} onSave={saveRates} />
      <NewDebtModal open={modal === "debt"} onClose={() => setModal(null)} onCreate={createDebt} rates={optimistic.rates} />
      <FixedExpenseModal
        open={modal === "fixed"}
        onClose={() => setModal(null)}
        onCreate={createFixed}
        onUpdate={updateFixed}
        cards={optimistic.cards}
        rates={optimistic.rates}
        initial={fixedEdit}
        defaultCardId={fixedCardId}
      />

      <Toaster position="top-center" richColors />
    </>
  );
}
