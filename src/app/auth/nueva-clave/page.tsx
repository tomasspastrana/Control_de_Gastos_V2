"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid";

/**
 * The one screen where a new password is typed. Reached only with a recovery session, which can
 * arrive two ways: already in the cookies (the `?code=` link went through /auth/callback), or as
 * a `#access_token=...` fragment that `createBrowserClient` consumes on its own — that's how the
 * links sent from the Supabase dashboard come back, since they carry no PKCE verifier.
 *
 * It lives under /auth (public in PUBLIC_PATHS) and NOT under /login on purpose: the proxy sends
 * any logged-in visitor away from /login, and a recovery link logs you in.
 */
export default function NuevaClavePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    // fires once the client has parsed a recovery fragment out of the URL
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        done = true;
        setStatus("ready");
      }
    });

    // and covers the case where the session was already in the cookies
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        done = true;
        setStatus("ready");
      }
    });

    // no session either way → the link is spent, expired, or someone opened this URL by hand
    const timer = setTimeout(() => {
      if (!done) setStatus("invalid");
    }, 2500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== repeat) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--tj-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="tj-glass tj-pop" style={{ width: 400, maxWidth: "100%", padding: 30, borderRadius: 26 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: "var(--tj-grad)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(109,94,246,.4)" }}>
            <div style={{ width: 17, height: 12, borderRadius: 3, border: "2px solid #fff" }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-.02em" }}>Tarjetero</div>
            <div style={{ fontSize: 10.5, color: "var(--tj-muted)", fontWeight: 500, letterSpacing: ".04em" }}>NUEVA CONTRASEÑA</div>
          </div>
        </div>

        {status === "checking" && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tj-muted)", padding: "18px 0" }}>
            Verificando el link…
          </div>
        )}

        {status === "invalid" && (
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--tj-danger)", marginBottom: 6 }}>
              El link no es válido o ya venció
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tj-muted-2)", marginBottom: 18 }}>
              Los links de recuperación se pueden usar una sola vez. Pedí uno nuevo desde el login.
            </div>
            <a href="/login" className="tj-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Volver al login
            </a>
          </div>
        )}

        {status === "ready" && (
          <form onSubmit={onSubmit}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--tj-muted-2)", marginBottom: 16 }}>
              Elegí una contraseña nueva para entrar a tu cuenta.
            </div>
            <div className="tj-field">
              <label className="tj-label">Nueva contraseña</label>
              <input className="tj-input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="tj-field">
              <label className="tj-label">Repetila</label>
              <input className="tj-input" type="password" required minLength={6} value={repeat} onChange={(e) => setRepeat(e.target.value)} placeholder="La misma de arriba" />
            </div>

            {error && <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--tj-danger)", margin: "4px 0 12px" }}>{error}</div>}

            <button type="submit" className="tj-submit" disabled={saving} style={{ marginTop: 4 }}>
              {saving ? "Guardando…" : "Guardar y entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
