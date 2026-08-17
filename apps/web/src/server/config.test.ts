import { describe, expect, it } from "vitest";

import { readGamesConfig } from "./config";

const TEST_DATABASE_CA = `-----BEGIN CERTIFICATE-----
TEST
-----END CERTIFICATE-----`;

describe("Games Vercel configuration", () => {
  it("requires restricted Production database and STUN configuration", () => {
    expect(() => readGamesConfig({ NODE_ENV: "production" })).toThrow("GAME_DATABASE_ROLE");
    expect(() => readGamesConfig({
      GAME_DATABASE_ROLE: "games_api",
      GAME_DATABASE_URL: "postgresql://postgres:secret@db.example/postgres",
      GAME_STUN_URLS: "stun:stun.example.org:3478",
      NODE_ENV: "production",
    })).toThrow("owner or broad service credential");
  });

  it("keeps TURN optional and centralizes ICE configuration", () => {
    const config = readGamesConfig({
      GAME_DATABASE_CA: TEST_DATABASE_CA,
      GAME_DATABASE_ROLE: "games_api",
      GAME_DATABASE_URL: "postgresql://games_api_login:secret@db.example/postgres",
      GAME_STUN_URLS: "stun:stun.example.org:3478",
      NODE_ENV: "production",
    });
    expect(config.iceServers).toEqual([{ urls: ["stun:stun.example.org:3478"] }]);
    expect(config.gameSessionCookieName).toBe("__Host-ning_game_session");
  });
});
