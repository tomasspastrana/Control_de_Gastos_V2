"use client";

import { useEffect, useReducer, useState } from "react";
import type { AppData } from "@/lib/types";
import { reducer } from "@/lib/store";
import { mockData } from "@/lib/mock";

const STORAGE_KEY = "tarjetero_v4";

function loadLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<AppData>;
    if (!d.cards || !d.purchases) return null;
    return {
      rates: d.rates ?? mockData.rates,
      cards: d.cards,
      purchases: d.purchases,
      debts: d.debts ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Owns the domain data with a reducer, seeded from mock on the server and
 * hydrated from localStorage on the client (avoids SSR/hydration mismatch).
 * In Fase 5 the dispatch will be swapped for server actions.
 */
export function useTarjetero() {
  const [data, dispatch] = useReducer(reducer, mockData);
  const [hydrated, setHydrated] = useState(false);

  // hydrate from localStorage once, after the first client render
  useEffect(() => {
    const saved = loadLocal();
    if (saved) dispatch({ type: "HYDRATE", data: saved });
    setHydrated(true);
  }, []);

  // persist on every change (once hydrated)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [data, hydrated]);

  return { data, dispatch, hydrated };
}
