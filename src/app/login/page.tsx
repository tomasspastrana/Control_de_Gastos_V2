"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setInfo("Te enviamos un email para confirmar tu cuenta. Confirmalo y volvé a ingresar.");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--tj-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="tj-glass tj-pop" style={{ width: 400, maxWidth: "100%", padding: 30, borderRadius: 26 }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--tj-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(109,94,246,.4)" }}>
            <div style={{ width: 17, height: 12, borderRadius: 3, border: "2px solid #fff" }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.02em" }}>Tarjetero</div>
            <div style={{ fontSize: 10.5, color: "var(--tj-muted)", fontWeight: 500, letterSpacing: ".04em" }}>FINANZAS · PREMIUM</div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, background: "rgba(109,94,246,.08)", padding: 4, borderRadius: 12 }}>
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              style={{
                flex: 1,
                padding: "9px",
                border: "none",
                borderRadius: 9,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                background: mode === m ? "#fff" : "transparent",
                color: mode === m ? "var(--tj-debt)" : "var(--tj-muted-2)",
                boxShadow: mode === m ? "0 2px 8px rgba(80,70,160,.12)" : "none",
              }}
            >
              {m === "login" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit}>
          {mode === "signup" && (
            <div className="tj-field">
              <label className="tj-label">Tu nombre</label>
              <input className="tj-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Alexandra" />
            </div>
          )}
          <div className="tj-field">
            <label className="tj-label">Email</label>
            <input className="tj-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" />
          </div>
          <div className="tj-field">
            <label className="tj-label">Contraseña</label>
            <input className="tj-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>

          {error && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tj-danger)", margin: "4px 0 12px" }}>{error}</div>}
          {info && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tj-good)", margin: "4px 0 12px" }}>{info}</div>}

          <button type="submit" className="tj-submit" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Un momento…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
