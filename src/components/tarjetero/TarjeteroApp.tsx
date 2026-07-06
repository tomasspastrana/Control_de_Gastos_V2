"use client";

import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useTarjetero } from "@/hooks/useTarjetero";
import { THEMES } from "@/lib/types";
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

export function TarjeteroApp({ userEmail }: { userEmail: string }) {
  const { data, dispatch } = useTarjetero();
  const [view, setView] = useState<View>("dashboard");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const selectedCard = data.cards.find((c) => c.id === selectedCardId) ?? null;
  const effectiveView: View = view === "card" && !selectedCard ? "dashboard" : view;

  // navigation
  const openCard = (id: string) => {
    setSelectedCardId(id);
    setView("card");
  };
  const goHome = () => {
    setView("dashboard");
    setSelectedCardId(null);
  };
  const goDebts = () => {
    setView("debts");
    setSelectedCardId(null);
  };

  // modal defaults
  const defaultPurchaseCardId = selectedCardId ?? data.cards[0]?.id ?? "";
  const nextTheme = THEMES[data.cards.length % THEMES.length];

  // domain
  const deleteCard = (id: string) => {
    dispatch({ type: "DELETE_CARD", id });
    if (selectedCardId === id) goHome();
  };

  return (
    <>
      <AppShell
        sidebar={
          <Sidebar
            cards={data.cards}
            purchases={data.purchases}
            rates={data.rates}
            view={effectiveView}
            selectedCardId={selectedCardId}
            debtsCount={data.debts.length}
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
            data={data}
            onAddCard={() => setModal("card")}
            onOpenCard={openCard}
            onDeleteCard={deleteCard}
          />
        )}

        {effectiveView === "card" && selectedCard && (
          <CardDetail
            key={selectedCard.id}
            card={selectedCard}
            purchases={data.purchases}
            rates={data.rates}
            onBack={goHome}
            onAddPurchase={() => setModal("purchase")}
            onDeleteCard={() => deleteCard(selectedCard.id)}
            onPayAll={() => dispatch({ type: "PAY_CARD", cardId: selectedCard.id })}
            onPayDelta={(id, delta) => dispatch({ type: "PAY_DELTA", id, delta })}
            onDeletePurchase={(id) => dispatch({ type: "DELETE_PURCHASE", id })}
          />
        )}

        {effectiveView === "debts" && (
          <DebtsView
            debts={data.debts}
            rates={data.rates}
            onAddDebt={() => setModal("debt")}
            onPayDebtDelta={(id, delta) => dispatch({ type: "PAY_DEBT_DELTA", id, delta })}
            onDeleteDebt={(id) => dispatch({ type: "DELETE_DEBT", id })}
          />
        )}
      </AppShell>

      {/* modals (kept mounted for enter/exit animations) */}
      <NewCardModal
        open={modal === "card"}
        onClose={() => setModal(null)}
        onCreate={(card) => dispatch({ type: "ADD_CARD", card })}
        initialTheme={nextTheme}
      />
      <NewPurchaseModal
        open={modal === "purchase"}
        onClose={() => setModal(null)}
        onCreate={(purchase) => dispatch({ type: "ADD_PURCHASE", purchase })}
        cards={data.cards}
        rates={data.rates}
        defaultCardId={defaultPurchaseCardId}
      />
      <SettingsModal
        open={modal === "settings"}
        onClose={() => setModal(null)}
        rates={data.rates}
        onSave={(rates) => dispatch({ type: "SET_RATES", rates })}
      />
      <NewDebtModal
        open={modal === "debt"}
        onClose={() => setModal(null)}
        onCreate={(debt) => dispatch({ type: "ADD_DEBT", debt })}
        rates={data.rates}
      />

      <Toaster position="top-center" richColors />
    </>
  );
}
