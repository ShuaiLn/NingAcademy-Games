export interface AuthenticatedGameIdentity {
  readonly displayName: string;
  readonly gameSessionId: string;
  readonly role: "student";
  readonly userId: string;
}

export type SessionVerificationResult =
  | { readonly kind: "authenticated"; readonly identity: AuthenticatedGameIdentity }
  | {
      readonly kind: "rejected";
      readonly reason:
        | "account_not_ready"
        | "expired"
        | "invalid"
        | "revoked"
        | "service_unavailable";
    };

export interface GameSessionVerifier {
  verify(rawSessionToken: string): Promise<SessionVerificationResult>;
}

export const GAME_SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

const COOKIE_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,64}$/;

/**
 * Reads a single opaque cookie without URL-decoding or accepting duplicate
 * names. Tokens are generated from base64url bytes and never contain `;`/`=`.
 */
export function readOpaqueCookie(
  cookieHeader: string | null | undefined,
  cookieName: string,
): string | null {
  if (!COOKIE_NAME_PATTERN.test(cookieName) || cookieHeader === null || cookieHeader === undefined) {
    return null;
  }

  if (cookieHeader.length > 8_192) {
    return null;
  }

  let match: string | null = null;
  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 1) {
      continue;
    }

    const name = cookie.slice(0, separator).trim();
    if (name !== cookieName) {
      continue;
    }

    const value = cookie.slice(separator + 1).trim();
    if (match !== null || !GAME_SESSION_TOKEN_PATTERN.test(value)) {
      return null;
    }
    match = value;
  }

  return match;
}

/** Fails every room closed until the restricted staging RPC is configured. */
export class UnavailableGameSessionVerifier implements GameSessionVerifier {
  verify(rawSessionToken: string): Promise<SessionVerificationResult> {
    void rawSessionToken;
    return Promise.resolve({ kind: "rejected", reason: "service_unavailable" });
  }
}
