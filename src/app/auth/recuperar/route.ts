import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailOtpType, safeNext } from "@/lib/redirect";

/**
 * Landing for the password-recovery email.
 *
 * The link arrives here with no query string of its own, on purpose: Supabase silently swaps a
 * `redirectTo` it doesn't find in the Redirect URLs allow list for the Site URL — no error, just a
 * dead link — and its docs neither document whether query params take part in that matching nor
 * recommend wildcards in production. So the allowed URL is one exact path and nothing else.
 *
 * Two token shapes are accepted:
 *  - `?code=`       what the default email template sends today (PKCE). The exchange happens here,
 *                   server-side, so it never depends on the code_verifier cookie being readable
 *                   from JavaScript.
 *  - `?token_hash=` what a custom template would send. Nothing produces this yet — free-tier
 *                   projects can't edit auth templates — but it costs nothing to already accept.
 *
 * On failure we still redirect: with no session, /auth/nueva-clave reports the dead link and
 * offers a way to request another, so there's no error to thread through the URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  // the email carries no `next`, hence the explicit fallback
  const next = safeNext(url.searchParams.get("next"), "/auth/nueva-clave");

  if (code || tokenHash) {
    const supabase = await createClient();
    if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    } else if (tokenHash && isEmailOtpType(type)) {
      await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}
