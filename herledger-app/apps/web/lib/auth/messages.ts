/**
 * Every credential-failure path in Better Auth's signInEmail (unknown
 * email, no credential account on the user, wrong password) already
 * normalizes to this exact string server-side — see
 * BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD in
 * @better-auth/core/dist/error/codes.mjs (installed at better-auth@1.6.28)
 * — and that path even does a dummy password hash on the "not found" case
 * so response timing doesn't leak which case it was.
 */
export const GENERIC_SIGN_IN_ERROR = "Invalid email or password";

/**
 * Normalizes any sign-in failure to a single generic message, regardless
 * of the underlying Better Auth error code. This is a defensive second
 * layer on top of Better Auth's own (already-generic) server-side message:
 * it stops the client from ever surfacing a *different*, more specific
 * message verbatim — e.g. from a future plugin, a misconfiguration, or an
 * upstream change — that could distinguish "no such user" from "wrong
 * password" and enable user enumeration.
 */
export function normalizeSignInError(_error: unknown): string {
  return GENERIC_SIGN_IN_ERROR;
}
