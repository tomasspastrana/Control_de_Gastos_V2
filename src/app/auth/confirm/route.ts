import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailOtpType, safeNext } from "@/lib/redirect";

/**
 * Landing for email links that point straight at the app, carrying a `token_hash`.
 *
 * This exists because the other shape — `{{ .ConfirmationURL }}`, which routes through Supabase's
 * own /auth/v1/verify — drags a `redirect_to` along, and Supabase silently swaps that for the
 * Site URL when it isn't in the Redirect URLs allow list. No error, just a link that lands
 * nowhere. Pointing the email template here removes `redirect_to` from the flow entirely: the
 * token is verified server-side, the session goes into cookies, and nothing depends on config.
 *
 * On failure we still redirect to `next`: with no session, /auth/nueva-clave already reports the
 * dead link and offers a way to request another.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && isEmailOtpType(type)) {
    const supabase = await createClient();
    await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  }

  return NextResponse.redirect(new URL(next, request.url));
}
