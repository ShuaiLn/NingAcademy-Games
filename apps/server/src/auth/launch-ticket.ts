import { GAME_SESSION_TOKEN_PATTERN } from "./game-session.js";

export const LAUNCH_TICKET_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export interface LaunchRequestContext {
  readonly origin: string | undefined;
  readonly secFetchDest: string | undefined;
  readonly secFetchMode: string | undefined;
  readonly secFetchSite: string | undefined;
}

export interface RedeemedLaunchTicket {
  readonly expiresAt: Date;
  readonly rawSessionToken: string;
}

export type LaunchTicketRedemption =
  | { readonly kind: "redeemed"; readonly value: RedeemedLaunchTicket }
  | {
      readonly kind: "rejected";
      readonly reason:
        | "already_redeemed"
        | "expired"
        | "ineligible"
        | "invalid"
        | "service_unavailable";
    };

export interface LaunchTicketRedeemer {
  redeem(rawLaunchTicket: string): Promise<LaunchTicketRedemption>;
}

export type LaunchRequestRejection =
  | "fetch_metadata_required"
  | "invalid_origin"
  | "invalid_ticket";

export function validateLaunchRequest(
  rawLaunchTicket: unknown,
  context: LaunchRequestContext,
  expectedMainOrigin: string,
): { readonly kind: "accepted"; readonly rawLaunchTicket: string } | {
  readonly kind: "rejected";
  readonly reason: LaunchRequestRejection;
} {
  if (context.origin !== expectedMainOrigin) {
    return { kind: "rejected", reason: "invalid_origin" };
  }

  if (
    (context.secFetchSite !== "same-site" && context.secFetchSite !== "same-origin")
    || context.secFetchMode !== "navigate"
    || context.secFetchDest !== "document"
  ) {
    return { kind: "rejected", reason: "fetch_metadata_required" };
  }

  if (typeof rawLaunchTicket !== "string" || !LAUNCH_TICKET_PATTERN.test(rawLaunchTicket)) {
    return { kind: "rejected", reason: "invalid_ticket" };
  }

  return { kind: "accepted", rawLaunchTicket };
}

export interface SessionCookieOptions {
  readonly cookieName: string;
  readonly expiresAt: Date;
  readonly now: Date;
  readonly rawSessionToken: string;
  readonly secure: boolean;
}

export function buildSessionCookie(options: SessionCookieOptions): string {
  if (!GAME_SESSION_TOKEN_PATTERN.test(options.rawSessionToken)) {
    throw new Error("invalid game session token");
  }

  const remainingSeconds = Math.floor(
    (options.expiresAt.getTime() - options.now.getTime()) / 1_000,
  );
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
    throw new Error("game session must expire in the future");
  }

  const attributes = [
    `${options.cookieName}=${options.rawSessionToken}`,
    "Path=/",
    `Max-Age=${remainingSeconds}`,
    "HttpOnly",
    "SameSite=Strict",
  ];
  if (options.secure) {
    attributes.push("Secure");
  }

  // Domain is deliberately omitted. Only the authoritative server host can
  // receive the opaque session cookie.
  return attributes.join("; ");
}

export class UnavailableLaunchTicketRedeemer implements LaunchTicketRedeemer {
  redeem(rawLaunchTicket: string): Promise<LaunchTicketRedemption> {
    void rawLaunchTicket;
    return Promise.resolve({ kind: "rejected", reason: "service_unavailable" });
  }
}
