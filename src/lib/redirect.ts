// Sanitizers for the values that arrive inside auth email links. Everything in those URLs is
// user-supplied text by the time it hits our routes, so nothing here trusts its input.

import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Where an auth callback is allowed to send the browser afterwards.
 *
 * The `next` parameter travels through an email link, so it's attacker-controllable: an absolute
 * URL there would turn our own domain into a springboard to somewhere else (open redirect), with
 * the credibility of having come from a real login flow. Only same-site absolute paths pass.
 */
export function safeNext(raw: string | null, fallback = "/"): string {
  if (!raw) return fallback;
  // must be a path on this site: "/algo" — but not "//host" (protocol-relative) or "/\host"
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/** The email OTP kinds we accept in /auth/confirm. */
const EMAIL_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

/**
 * `EmailOtpType` is widened with `(string & {})` upstream, so TypeScript would happily let any
 * string through to `verifyOtp`. This narrows it back to the real set instead of casting a query
 * parameter straight into the auth call.
 */
export function isEmailOtpType(raw: string | null): raw is EmailOtpType {
  return !!raw && (EMAIL_OTP_TYPES as readonly string[]).includes(raw);
}
