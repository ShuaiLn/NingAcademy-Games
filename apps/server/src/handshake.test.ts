import { ServerError } from "@colyseus/core";
import { PROTOCOL_VERSION } from "@ningacademy/protocol";
import { describe, expect, it } from "vitest";

import { authorizeRoomHandshake } from "./handshake.js";

const identity = {
  displayName: "Student",
  gameSessionId: "11111111-1111-4111-8111-111111111111",
  role: "student" as const,
  userId: "22222222-2222-4222-8222-222222222222",
};

const definition = {
  expectedOrigin: "https://game.ningacademy.org",
  sessionCookieName: "ningacademy_game_session",
  sessionVerifier: {
    verify: () => Promise.resolve({ kind: "authenticated" as const, identity }),
  },
};

function headers(origin: string | undefined, withCookie = true): Headers {
  const result = new Headers(origin === undefined ? undefined : { origin });
  if (withCookie) {
    result.set("cookie", `ningacademy_game_session=${"A".repeat(43)}`);
  }
  return result;
}

describe("room version handshake", () => {
  it("authorizes the exact origin, protocol, and HttpOnly-cookie identity", async () => {
    await expect(authorizeRoomHandshake(
      { protocolVersion: PROTOCOL_VERSION },
      { headers: headers("https://game.ningacademy.org") },
      definition,
    )).resolves.toEqual({ identity, protocolVersion: PROTOCOL_VERSION });
  });

  it("rejects a mismatched version with upgrade required", async () => {
    try {
      await authorizeRoomHandshake(
        { protocolVersion: PROTOCOL_VERSION + 1 },
        { headers: headers("https://game.ningacademy.org") },
        definition,
      );
      throw new Error("expected handshake rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ServerError);
      expect((error as ServerError).code).toBe(426);
      expect((error as ServerError).message).toBe("game_protocol_mismatch");
    }
  });

  it("rejects missing or foreign origins", async () => {
    for (const origin of [undefined, "https://attacker.example"]) {
      await expect(authorizeRoomHandshake(
        { protocolVersion: PROTOCOL_VERSION },
        { headers: headers(origin) },
        definition,
      )).rejects.toThrow("origin_not_allowed");
    }
  });

  it("rejects the legacy string protocol value", async () => {
    await expect(authorizeRoomHandshake(
      { protocolVersion: String(PROTOCOL_VERSION) },
      { headers: headers("https://game.ningacademy.org") },
      definition,
    )).rejects.toThrow("protocol_version_required");
  });

  it("rejects missing sessions without accepting the Colyseus token path", async () => {
    await expect(authorizeRoomHandshake(
      { protocolVersion: PROTOCOL_VERSION },
      { headers: headers("https://game.ningacademy.org", false) },
      definition,
    )).rejects.toThrow("game_session_required");
  });

  it("fails closed while the restricted identity service is unavailable", async () => {
    await expect(authorizeRoomHandshake(
      { protocolVersion: PROTOCOL_VERSION },
      { headers: headers("https://game.ningacademy.org") },
      {
        ...definition,
        sessionVerifier: {
          verify: () => Promise.resolve({
            kind: "rejected" as const,
            reason: "service_unavailable" as const,
          }),
        },
      },
    )).rejects.toMatchObject({ code: 503, message: "game_identity_unavailable" });
  });
});
