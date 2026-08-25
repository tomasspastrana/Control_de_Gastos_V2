import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirect";

/**
 * Landing for the email links the app itself sends (password recovery today).
 *
 * `createBrowserClient` uses PKCE, so the link comes back as `?code=...` with the matching
 * `code_verifier` sitting in a cookie — which only the server can read. Exchanging it here puts
 * the session in the cookies before we hand the browser to `next`.
 *
 * The links sent from the Supabase dashboard do NOT come through here: they have no verifier, so
 * they arrive as a `#access_token=...` fragment that never reaches the server. The login page
 * bridges that case client-side.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // On failure we still send the browser to `next`: with no session established, that screen
  // already reports "link inválido o vencido" and offers a way to ask for a new one. Passing an
  // error string back through the URL would only duplicate that message somewhere else.
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
