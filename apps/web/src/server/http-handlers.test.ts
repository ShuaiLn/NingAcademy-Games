import { describe, expect, it } from "vitest";

import type { GamesConfig } from "./config";
import { handleCreateRoom, handleJoinRoom, handleRedeem, handleSessionStatus } from "./http-handlers";
import { GamesDatabaseError, type GamesGateway } from "./postgres-games-gateway";


const TEST_DATABASE_CA = `-----BEGIN CERTIFICATE-----
TEST
-----END CERTIFICATE-----`;

const ticket = "T".repeat(43);
const sessionToken = "S".repeat(43);
const config: GamesConfig = {
  databaseCa: TEST_DATABASE_CA,
  databaseRole: "games_api",
  databaseUrl: "postgresql://games_api_login:secret@db.example/postgres",
  gameSessionCookieName: "__Host-ning_game_session",
  iceServers: [{ urls: ["stun:stun.example.org:3478"] }],
  mainOrigin: "https://ningacademy.org",
  nodeEnv: "production",
  protocolVersion: 1,
  rulesetVersion: "p0",
  webOrigin: "https://game.ningacademy.org",
};

function gateway(overrides: Partial<GamesGateway> = {}): GamesGateway {
  const unavailable = <T>(): Promise<T> => Promise.reject(new Error("unexpected gateway call"));
  return {
    createRoom: () => unavailable(),
    endRoom: () => unavailable(),
    joinRoom: () => unavailable(),
    leaveRoom: () => unavailable(),
    pollRoom: () => unavailable(),
    redeem: () => unavailable(),
    saveCheckpoint: () => unavailable(),
    sendSignal: () => unavailable(),
    setReady: () => unavailable(),
    startRoom: () => unavailable(),
    verify: () => unavailable(),
    ...overrides,
  };
}

function mutationHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Cookie: `__Host-ning_game_session=${sessionToken}`,
    Origin: config.webOrigin,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

describe("Games Route Handler security", () => {
  it("atomically exchanges a body-only ticket into a strict host cookie", async () => {
    let redeemed = false;
    const request = () => new Request("https://game.ningacademy.org/redeem", {
      body: new URLSearchParams({ ticket }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: config.mainOrigin,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-site",
      },
      method: "POST",
    });
    const auth = gateway({
      redeem: () => {
        if (redeemed) return Promise.resolve({ kind: "rejected", reason: "invalid" } as const);
        redeemed = true;
        return Promise.resolve({
          expiresAt: new Date("2026-08-16T01:00:00.000Z"),
          kind: "redeemed",
          rawSessionToken: sessionToken,
        } as const);
      },
    });
    const first = await handleRedeem(request(), config, auth, () => new Date("2026-08-16T00:00:00.000Z"));
    expect(first.status).toBe(303);
    expect(first.headers.get("set-cookie")).toContain("__Host-ning_game_session=");
    expect(first.headers.get("set-cookie")).toContain("HttpOnly");
    expect(first.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(first.headers.get("set-cookie")).not.toContain("Domain=");
    expect((await handleRedeem(request(), config, auth)).status).toBe(401);
  });

  it("does not accept Authorization or Supabase-style bearer identity", async () => {
    const response = await handleSessionStatus(new Request("https://game.ningacademy.org/api/session", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    }), config, gateway());
    expect(response.status).toBe(401);
  });

  it("rejects malformed launch tickets before a database exchange", async () => {
    const response = await handleRedeem(new Request("https://game.ningacademy.org/redeem", {
      body: new URLSearchParams({ ticket: "forged" }),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: config.mainOrigin,
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-site",
      },
      method: "POST",
    }), config, gateway());
    expect(response.status).toBe(400);
  });

  it("creates a 2–8 player room only from same-origin JSON plus the Games cookie", async () => {
    let maxPlayers = 0;
    const auth = gateway({
      createRoom: (_token, value) => {
        maxPlayers = value;
        return Promise.resolve({
          expiresAt: "2026-08-16T01:00:00.000Z",
          hostMemberId: "10000000-0000-4000-8000-000000000001",
          memberId: "10000000-0000-4000-8000-000000000001",
          roomCode: "N7K4PQ",
          roomId: "20000000-0000-4000-8000-000000000001",
          topologyEpoch: 1,
        });
      },
    });
    const response = await handleCreateRoom(new Request("https://game.ningacademy.org/api/p2p/rooms", {
      body: JSON.stringify({ maxPlayers: 8 }),
      headers: mutationHeaders(),
      method: "POST",
    }), config, auth);
    expect(response.status).toBe(201);
    expect(maxPlayers).toBe(8);

    const forged = await handleCreateRoom(new Request("https://game.ningacademy.org/api/p2p/rooms", {
      body: JSON.stringify({ maxPlayers: 8 }),
      headers: { ...mutationHeaders(), Origin: "https://attacker.example" },
      method: "POST",
    }), config, auth);
    expect(forged.status).toBe(400);
  });

  it("reports invalid and full room joins without exposing database details", async () => {
    const invalidCode = await handleJoinRoom(new Request("https://game.ningacademy.org/api/p2p/rooms/join", {
      body: JSON.stringify({ roomCode: "O0I1" }),
      headers: mutationHeaders(),
      method: "POST",
    }), config, gateway());
    expect(invalidCode.status).toBe(400);

    const fullRoom = await handleJoinRoom(new Request("https://game.ningacademy.org/api/p2p/rooms/join", {
      body: JSON.stringify({ roomCode: "N7K4PQ" }),
      headers: mutationHeaders(),
      method: "POST",
    }), config, gateway({
      joinRoom: () => Promise.reject(new GamesDatabaseError("full", "internal capacity detail")),
    }));
    expect(fullRoom.status).toBe(409);
    expect(await fullRoom.json()).toEqual({ error: "full" });
  });
});
