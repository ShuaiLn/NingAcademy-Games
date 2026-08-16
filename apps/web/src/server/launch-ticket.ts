import { GAME_SESSION_TOKEN_PATTERN } from "./game-session";

export const LAUNCH_TICKET_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export interface LaunchRequestContext {
  readonly origin: string | null;
  readonly secFetchDest: string | null;
  readonly secFetchMode: string | null;
  readonly secFetchSite: string | null;
}

export type LaunchTicketRedemption =
  | { readonly kind: "redeemed"; readonly expiresAt: Date; readonly rawSessionToken: string }
  | { readonly kind: "rejected"; readonly reason: "invalid" | "service_unavailable" };

export interface LaunchTicketRedeemer {
  redeem(rawLaunchTicket: string): Promise<LaunchTicketRedemption>;
}

export function validateLaunchRequest(
  rawLaunchTicket: unknown,
  context: LaunchRequestContext,
  expectedMainOrigin: string,
): rawLaunchTicket is string {
  return context.origin === expectedMainOrigin
    && (context.secFetchSite === "same-site" || context.secFetchSite === "same-origin")
    && context.secFetchMode === "navigate"
    && context.secFetchDest === "document"
    && typeof rawLaunchTicket === "string"
    && LAUNCH_TICKET_PATTERN.test(rawLaunchTicket);
}

export function buildSessionCookie(options: {
  readonly cookieName: string;
  readonly expiresAt: Date;
  readonly now: Date;
  readonly rawSessionToken: string;
  readonly secure: boolean;
}): string {
  if (!GAME_SESSION_TOKEN_PATTERN.test(options.rawSessionToken)) {
    throw new Error("invalid game session token");
  }
  if (options.cookieName.startsWith("__Host-") && !options.secure) {
    throw new Error("__Host- cookies require Secure");
  }
  const maxAge = Math.floor((options.expiresAt.getTime() - options.now.getTime()) / 1_000);
  if (!Number.isSafeInteger(maxAge) || maxAge <= 0) {
    throw new Error("game session must expire in the future");
  }
  return [
    `${options.cookieName}=${options.rawSessionToken}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}
