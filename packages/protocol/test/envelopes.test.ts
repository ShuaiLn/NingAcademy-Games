import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  createCommandEnvelope,
  createEventEnvelopes,
  decodeCommandEnvelope,
  isCommandEnvelope,
  isEventEnvelope,
} from "../src/index.js";

describe("versioned protocol envelopes", () => {
  it("creates and decodes a supported command", () => {
    const envelope = createCommandEnvelope({
      roomId: "room-1",
      commandId: "command-1",
      sentAtMs: 100,
      expectedRevision: 2,
      payload: { type: "player.ready", ready: true },
    });

    expect(envelope.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(decodeCommandEnvelope(envelope)).toEqual({ ok: true, value: envelope });
  });

  it("rejects identity fields supplied by a client", () => {
    const smuggledEnvelope = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "game.command",
      roomId: "room-1",
      commandId: "command-1",
      sentAtMs: 100,
      actor: { kind: "user", userId: "forged-user" },
      payload: { type: "player.join", displayName: "Forged" },
    };

    expect(isCommandEnvelope(smuggledEnvelope)).toBe(false);
    expect(decodeCommandEnvelope(smuggledEnvelope)).toMatchObject({
      ok: false,
      error: { code: "INVALID_ENVELOPE" },
    });
  });

  it("distinguishes unsupported protocol versions", () => {
    const result = decodeCommandEnvelope({
      protocolVersion: 999,
      messageType: "game.command",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_PROTOCOL_VERSION" },
    });
  });

  it("wraps domain events with stable revision-scoped ids", () => {
    const [event] = createEventEnvelopes({
      roomId: "room-1",
      revision: 3,
      occurredAtMs: 200,
      events: [{ type: "player.ready_changed", playerId: "alice", ready: true }],
    });

    expect(event?.eventId).toBe("room-1:3:0");
    expect(isEventEnvelope(event)).toBe(true);
  });
});
