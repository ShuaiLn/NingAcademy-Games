import { ServerError, type AuthContext } from "@colyseus/core";
import { PROTOCOL_VERSION } from "@ningacademy/protocol";

import {
  readOpaqueCookie,
  type AuthenticatedGameIdentity,
  type GameSessionVerifier,
} from "./auth/game-session.js";
import { isAllowedOrigin } from "./config.js";

export interface RoomAuthorization {
  identity: AuthenticatedGameIdentity;
  protocolVersion: typeof PROTOCOL_VERSION;
}

interface HandshakeOptions {
  protocolVersion: unknown;
}

export interface RoomDefinition {
  expectedOrigin: string;
  sessionCookieName: string;
  sessionVerifier: GameSessionVerifier;
}

function asHandshakeOptions(value: unknown): HandshakeOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ServerError(400, "invalid_handshake");
  }

  const record = value as Readonly<Record<string, unknown>>;
  return { protocolVersion: record.protocolVersion };
}

function requireString(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new ServerError(400, errorCode);
  }

  return value;
}

export async function authorizeRoomHandshake(
  rawOptions: unknown,
  context: Pick<AuthContext, "headers">,
  definition: RoomDefinition,
): Promise<RoomAuthorization> {
  const options = asHandshakeOptions(rawOptions);
  const expectedOrigin = requireString(
    definition.expectedOrigin,
    "server_origin_not_configured",
  );
  const requestedProtocol = options.protocolVersion;

  if (typeof requestedProtocol !== "number" || !Number.isSafeInteger(requestedProtocol)) {
    throw new ServerError(400, "protocol_version_required");
  }

  if (!isAllowedOrigin(context.headers.get("origin"), expectedOrigin)) {
    throw new ServerError(403, "origin_not_allowed");
  }

  if (requestedProtocol !== PROTOCOL_VERSION) {
    throw new ServerError(426, "game_protocol_mismatch");
  }

  const sessionToken = readOpaqueCookie(
    context.headers.get("cookie"),
    definition.sessionCookieName,
  );
  if (sessionToken === null) {
    throw new ServerError(401, "game_session_required");
  }

  const verification = await definition.sessionVerifier.verify(sessionToken);
  if (verification.kind === "rejected") {
    if (verification.reason === "service_unavailable") {
      throw new ServerError(503, "game_identity_unavailable");
    }
    if (verification.reason === "account_not_ready") {
      throw new ServerError(403, "game_account_not_ready");
    }
    throw new ServerError(401, `game_session_${verification.reason}`);
  }

  return {
    identity: verification.identity,
    protocolVersion: PROTOCOL_VERSION,
  };
}

export function readRoomDefinition(rawOptions: unknown): RoomDefinition {
  if (typeof rawOptions !== "object" || rawOptions === null || Array.isArray(rawOptions)) {
    throw new ServerError(500, "invalid_room_definition");
  }

  const options = rawOptions as Readonly<Record<string, unknown>>;

  if (
    typeof options.sessionVerifier !== "object"
    || options.sessionVerifier === null
    || typeof (options.sessionVerifier as Partial<GameSessionVerifier>).verify !== "function"
  ) {
    throw new ServerError(500, "server_session_verifier_not_configured");
  }

  return {
    expectedOrigin: requireString(options.expectedOrigin, "server_origin_not_configured"),
    sessionCookieName: requireString(
      options.sessionCookieName,
      "server_session_cookie_not_configured",
    ),
    sessionVerifier: options.sessionVerifier as GameSessionVerifier,
  };
}
