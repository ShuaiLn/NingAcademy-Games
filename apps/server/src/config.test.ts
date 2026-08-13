import { PROTOCOL_VERSION } from "@ningacademy/protocol";
import { describe, expect, it } from "vitest";

import { isAllowedOrigin, readServerConfig } from "./config.js";

describe("server configuration", () => {
  it("provides safe local defaults", () => {
    expect(readServerConfig({})).toEqual({
      gameSessionCookieName: "ningacademy_game_session",
      mainOrigin: "http://localhost:3001",
      nodeEnv: "development",
      port: 2567,
      protocolVersion: PROTOCOL_VERSION,
      region: "local",
      webOrigin: "http://localhost:3000",
    });
  });

  it("uses the shared protocol package instead of an environment override", () => {
    expect(readServerConfig({ GAME_PROTOCOL_VERSION: "999" }).protocolVersion).toBe(
      PROTOCOL_VERSION,
    );
  });

  it("requires HTTPS and an explicit origin in production", () => {
    expect(() => readServerConfig({ NODE_ENV: "production" })).toThrow(
      "GAME_WEB_ORIGIN is required",
    );
    expect(() => readServerConfig({
      NODE_ENV: "production",
      GAME_WEB_ORIGIN: "https://game.ningacademy.org",
    })).toThrow("NINGACADEMY_MAIN_ORIGIN is required");
    expect(() => readServerConfig({
      NODE_ENV: "production",
      GAME_WEB_ORIGIN: "http://game.ningacademy.org",
      NINGACADEMY_MAIN_ORIGIN: "https://www.ningacademy.org",
    })).toThrow("must use HTTPS");
  });

  it("rejects origin paths and invalid ports", () => {
    expect(() => readServerConfig({
      GAME_WEB_ORIGIN: "http://localhost:3000/play",
    })).toThrow("scheme, host, and optional port");
    expect(() => readServerConfig({ PORT: "65536" })).toThrow("between 1 and 65535");
    expect(() => readServerConfig({ GAME_SESSION_COOKIE_NAME: "session; injected=1" })).toThrow(
      "unsupported characters",
    );
  });

  it("matches browser origins exactly", () => {
    expect(isAllowedOrigin("https://game.ningacademy.org", "https://game.ningacademy.org")).toBe(true);
    expect(isAllowedOrigin("https://preview.ningacademy.org", "https://game.ningacademy.org")).toBe(false);
    expect(isAllowedOrigin(undefined, "https://game.ningacademy.org")).toBe(false);
  });
});
