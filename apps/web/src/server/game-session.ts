export interface AuthenticatedGameIdentity {
  readonly assignmentId: string;
  readonly displayName: string;
  readonly expiresAt: Date;
  readonly gameSessionId: string;
  readonly role: "student";
  readonly userId: string;
}

export type SessionVerificationResult =
  | { readonly kind: "authenticated"; readonly identity: AuthenticatedGameIdentity }
  | { readonly kind: "rejected"; readonly reason: "invalid" | "service_unavailable" };

export interface GameSessionVerifier {
  verify(rawSessionToken: string): Promise<SessionVerificationResult>;
}

export const GAME_SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;

/** Reads exactly one opaque base64url cookie and rejects duplicate names. */
export function readOpaqueCookie(
  cookieHeader: string | null | undefined,
  cookieName: string,
): string | null {
  if (!COOKIE_NAME_PATTERN.test(cookieName) || !cookieHeader || cookieHeader.length > 8_192) {
    return null;
  }

  let match: string | null = null;
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 1 || cookie.slice(0, separator).trim() !== cookieName) continue;
    const value = cookie.slice(separator + 1).trim();
    if (match !== null || !GAME_SESSION_TOKEN_PATTERN.test(value)) return null;
    match = value;
  }
  return match;
}
