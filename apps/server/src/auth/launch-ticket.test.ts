import { describe, expect, it } from "vitest";

import {
  buildSessionCookie,
  validateLaunchRequest,
} from "./launch-ticket.js";

const ticket = "T".repeat(43);
const validContext = {
  origin: "https://www.ningacademy.org",
  secFetchDest: "document",
  secFetchMode: "navigate",
  secFetchSite: "same-site",
};

describe("launch ticket exchange boundary", () => {
  it("accepts only a same-site top-level POST shape from the exact main origin", () => {
    expect(
      validateLaunchRequest(ticket, validContext, "https://www.ningacademy.org"),
    ).toEqual({ kind: "accepted", rawLaunchTicket: ticket });

    expect(
      validateLaunchRequest(
        ticket,
        { ...validContext, origin: "https://attacker.example" },
        "https://www.ningacademy.org",
      ),
    ).toEqual({ kind: "rejected", reason: "invalid_origin" });

    expect(
      validateLaunchRequest(
        ticket,
        { ...validContext, secFetchMode: "cors" },
        "https://www.ningacademy.org",
      ),
    ).toEqual({ kind: "rejected", reason: "fetch_metadata_required" });
  });

  it("rejects malformed tickets before the restricted RPC", () => {
    expect(
      validateLaunchRequest("short", validContext, "https://www.ningacademy.org"),
    ).toEqual({ kind: "rejected", reason: "invalid_ticket" });
  });

  it("builds a host-only, HttpOnly, strict production cookie", () => {
    const cookie = buildSessionCookie({
      cookieName: "ningacademy_game_session",
      expiresAt: new Date("2026-08-13T01:00:00.000Z"),
      now: new Date("2026-08-13T00:00:00.000Z"),
      rawSessionToken: "S".repeat(43),
      secure: true,
    });

    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=3600");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });
});
