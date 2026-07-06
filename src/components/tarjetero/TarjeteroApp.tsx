"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Toaster } from "@/components/ui/sonner";
import { reducer, type Action } from "@/lib/store";
import { THEMES, type AppData, type Card, type Debt, type Purchase, type Rates } from "@/lib/types";
import * as actions from "@/app/actions";
import { AppShell } from "./AppShell";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { CardDetail } from "./CardDetail";
import { DebtsView } from "./DebtsView";
import { NewCardModal } from "./modals/NewCardModal";
import { NewPurchaseModal } from "./modals/NewPurchaseModal";
import { SettingsModal } from "./modals/SettingsModal";
import { NewDebtModal } from "./modals/NewDebtModal";

type View = "dashboard" | "card" | "debts";
type Modal = null | "card" | "purchase" | "settings" | "debt";

export function TarjeteroApp({ data, userEmail }: { data: AppData; userEmail: string }) {
  // optimistic overlay on top of the server data, driven by the same pure reducer
  const [optimistic, applyOptimistic] = useOptimistic(data, reducer);
  const [, startTransition] = useTransition();

  const [view, setView] = useState<View>("dashboard");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

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
  const deletePurchase = (id: string) => run({ type: "DELETE_PURCHASE", id }, () => actions.deletePurchase(id));
  const payDelta = (id: string, delta: number) => run({ type: "PAY_DELTA", id, delta }, () => actions.payPurchaseDelta(id, delta));
  const payCard = (cardId: string) => run({ type: "PAY_CARD", cardId }, () => actions.payCard(cardId));
  const createDebt = (d: Debt) => run({ type: "ADD_DEBT", debt: d }, () => actions.createDebt(d));
  const deleteDebt = (id: string) => run({ type: "DELETE_DEBT", id }, () => actions.deleteDebt(id));
  const payDebtDelta = (id: string, delta: number) => run({ type: "PAY_DEBT_DELTA", id, delta }, () => actions.payDebtDelta(id, delta));
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
            view={effectiveView}
            selectedCardId={selectedCardId}
            debtsCount={optimistic.debts.length}
            onAddPurchase={() => setModal("purchase")}
            onGoHome={goHome}
            onGoDebts={goDebts}
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
          />
        )}

        {effectiveView === "card" && selectedCard && (
          <CardDetail
            key={selectedCard.id}
            card={selectedCard}
            purchases={optimistic.purchases}
            rates={optimistic.rates}
            onBack={goHome}
            onAddPurchase={() => setModal("purchase")}
            onDeleteCard={() => deleteCard(selectedCard.id)}
            onPayAll={() => payCard(selectedCard.id)}
            onPayDelta={payDelta}
            onDeletePurchase={deletePurchase}
          />
        )}

        {effectiveView === "debts" && (
          <DebtsView
            debts={optimistic.debts}
            rates={optimistic.rates}
            onAddDebt={() => setModal("debt")}
            onPayDebtDelta={payDebtDelta}
            onDeleteDebt={deleteDebt}
          />
        )}
      </AppShell>

      <NewCardModal open={modal === "card"} onClose={() => setModal(null)} onCreate={createCard} initialTheme={nextTheme} />
      <NewPurchaseModal open={modal === "purchase"} onClose={() => setModal(null)} onCreate={createPurchase} cards={optimistic.cards} rates={optimistic.rates} defaultCardId={defaultPurchaseCardId} />
      <SettingsModal open={modal === "settings"} onClose={() => setModal(null)} rates={optimistic.rates} onSave={saveRates} />
      <NewDebtModal open={modal === "debt"} onClose={() => setModal(null)} onCreate={createDebt} rates={optimistic.rates} />

      <Toaster position="top-center" richColors />
    </>
  );
}
