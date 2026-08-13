import { describe, expect, it } from "vitest";

import {
  readOpaqueCookie,
  UnavailableGameSessionVerifier,
} from "./game-session.js";

const token = "A".repeat(43);

describe("game session boundary", () => {
  it("reads one valid opaque base64url cookie", () => {
    expect(
      readOpaqueCookie(`theme=dark; ningacademy_game_session=${token}; locale=zh`, "ningacademy_game_session"),
    ).toBe(token);
  });

  it("rejects duplicate, encoded, short, and oversized cookies", () => {
    expect(
      readOpaqueCookie(
        `ningacademy_game_session=${token}; ningacademy_game_session=${token}`,
        "ningacademy_game_session",
      ),
    ).toBeNull();
    expect(
      readOpaqueCookie("ningacademy_game_session=abc%2Fdef", "ningacademy_game_session"),
    ).toBeNull();
    expect(
      readOpaqueCookie("ningacademy_game_session=short", "ningacademy_game_session"),
    ).toBeNull();
    expect(readOpaqueCookie(`x=${"A".repeat(8_193)}`, "x")).toBeNull();
  });

  it("rejects unsafe cookie names", () => {
    expect(readOpaqueCookie(`session=${token}`, "session; injected=1")).toBeNull();
  });

  it("uses a fail-closed verifier until staging is connected", async () => {
    await expect(new UnavailableGameSessionVerifier().verify(token)).resolves.toEqual({
      kind: "rejected",
      reason: "service_unavailable",
    });
  });
});
