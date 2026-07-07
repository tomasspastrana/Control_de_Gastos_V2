import { describe, expect, it } from "vitest";
import { normalizeAmount, purchaseSchema, toAmount } from "./schemas";

describe("normalizeAmount", () => {
  it("keeps plain dot-decimals", () => {
    expect(normalizeAmount("1234.56")).toBe("1234.56");
  });
  it("treats comma as the decimal separator (AR)", () => {
    expect(normalizeAmount("1200,50")).toBe("1200.50");
  });
  it("drops dot thousands separators when a decimal comma is present", () => {
    expect(normalizeAmount("1.234.567,89")).toBe("1234567.89");
  });
  it("passes non-strings through untouched", () => {
    expect(normalizeAmount(42)).toBe(42);
  });
});

describe("toAmount", () => {
  it("parses AR-formatted strings to numbers", () => {
    expect(toAmount("1.200,50")).toBeCloseTo(1200.5);
  });
  it("returns 0 for empty / garbage", () => {
    expect(toAmount("")).toBe(0);
    expect(toAmount("abc")).toBe(0);
  });
});

describe("purchaseSchema amount", () => {
  const base = {
    cardId: "c1",
    merchant: "m",
    currency: "ARS",
    installments: "3",
    paidInstallments: "0",
    category: "Otros",
    date: "2026-01-01",
  };
  it("accepts a comma decimal amount", () => {
    const r = purchaseSchema.safeParse({ ...base, amount: "1200,50" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBeCloseTo(1200.5);
  });
  it("rejects a non-positive amount", () => {
    expect(purchaseSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
  });
});
