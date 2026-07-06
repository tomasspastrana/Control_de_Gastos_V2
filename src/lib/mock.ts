// Seed data (same demo dataset as the prototype). Used until the DB lands (Fase 3-5).

import type { AppData } from "./types";

export const mockData: AppData = {
  rates: { ARS: 1, USD: 1015, EUR: 1120 },
  cards: [
    { id: "c1", nickname: "Santander Visa", holder: "Alexandra Vaise", brand: "visa", last4: "1099", limit: 1_800_000, limitCurrency: "ARS", expiry: "08/27", theme: "violet" },
    { id: "c2", nickname: "Galicia Master", holder: "Alexandra Vaise", brand: "mastercard", last4: "4821", limit: 2_600_000, limitCurrency: "ARS", expiry: "03/28", theme: "coral" },
    { id: "c3", nickname: "BBVA Visa", holder: "Alexandra Vaise", brand: "visa", last4: "7734", limit: 1_400_000, limitCurrency: "ARS", expiry: "11/26", theme: "ocean" },
  ],
  purchases: [
    { id: "p1", cardId: "c1", merchant: "Apple Store", amount: 1200, currency: "USD", installments: 12, paidInstallments: 3, category: "Tecnología", date: "2026-02-01" },
    { id: "p2", cardId: "c1", merchant: "Coto Supermercado", amount: 85000, currency: "ARS", installments: 3, paidInstallments: 1, category: "Supermercado", date: "2026-05-14" },
    { id: "p3", cardId: "c2", merchant: "Dyson", amount: 1100, currency: "USD", installments: 6, paidInstallments: 2, category: "Tecnología", date: "2026-01-26" },
    { id: "p4", cardId: "c2", merchant: "Zara", amount: 240, currency: "EUR", installments: 6, paidInstallments: 0, category: "Indumentaria", date: "2026-04-08" },
    { id: "p5", cardId: "c3", merchant: "Despegar · Viaje", amount: 900, currency: "USD", installments: 9, paidInstallments: 4, category: "Viajes", date: "2026-03-11" },
    { id: "p6", cardId: "c2", merchant: "Farmacity", amount: 32000, currency: "ARS", installments: 3, paidInstallments: 0, category: "Salud", date: "2026-06-02" },
  ],
  debts: [
    { id: "d1", creditor: "Mi primo Juan", note: "Préstamo para la moto", amount: 1000, currency: "USD", installments: 12, paidInstallments: 3 },
  ],
};
