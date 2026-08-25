import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it("acepta rutas del propio sitio", () => {
    expect(safeNext("/auth/nueva-clave")).toBe("/auth/nueva-clave");
    expect(safeNext("/auth/nueva-clave?x=1")).toBe("/auth/nueva-clave?x=1");
  });

  it("cae al fallback cuando no viene nada", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext(null, "/login")).toBe("/login");
  });

  it("rechaza destinos externos (open redirect)", () => {
    // el `next` viaja dentro de un link de email: es texto que puede escribir un atacante
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/"); // protocol-relative
    expect(safeNext("/\\evil.com")).toBe("/"); // algunos navegadores lo tratan como //
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });
});
