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
