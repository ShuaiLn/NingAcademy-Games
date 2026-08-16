import { createCommandEnvelope } from "@ningacademy/protocol";
import { describe, expect, it } from "vitest";

import { HostP2PAuthorityRuntime } from "../src/index.js";

describe("host-authoritative P2P runtime", () => {
  it("binds actor identity to the peer channel and rejects payload membership changes", () => {
    const runtime = HostP2PAuthorityRuntime.create({
      maxPlayers: 8,
      nowMs: 1,
      roomId: "room-1",
      rulesetVersion: "p0",
      seed: "seed",
    });
    runtime.attachMember({ displayName: "Host", memberId: "host" }, 2);
    runtime.attachMember({ displayName: "Peer", memberId: "peer" }, 3);

    expect(() => runtime.processCommand("peer", createCommandEnvelope({
      commandId: "forged-join",
      payload: { displayName: "Forged", type: "player.join" },
      roomId: "room-1",
      sentAtMs: 4,
    }), 4)).toThrow("membership is controlled");

    const ready = runtime.processCommand("peer", createCommandEnvelope({
      commandId: "peer-ready",
      payload: { ready: true, type: "player.ready" },
      roomId: "room-1",
      sentAtMs: 5,
    }), 5);
    expect(ready.ack.accepted).toBe(true);
    expect(runtime.getSnapshot().players.peer?.ready).toBe(true);
  });

  it("restores a room-matched checkpoint for deterministic host migration", () => {
    const original = HostP2PAuthorityRuntime.create({ nowMs: 1, roomId: "room-1", rulesetVersion: "p0", seed: "seed" });
    original.attachMember({ displayName: "Host", memberId: "host" }, 2);
    const replacement = HostP2PAuthorityRuntime.create({ nowMs: 9, roomId: "room-1", rulesetVersion: "p0", seed: "other" });
    replacement.restoreCheckpoint(original.getSnapshot());
    expect(replacement.getSnapshot()).toEqual(original.getSnapshot());
  });

  it("keeps fixed-step combat advancement on the elected Host", () => {
    const runtime = HostP2PAuthorityRuntime.create({ nowMs: 1, roomId: "room-1", rulesetVersion: "p0", seed: "seed" });
    runtime.attachMember({ displayName: "Host", memberId: "host" }, 2);
    runtime.processCommand("host", createCommandEnvelope({
      commandId: "host-ready",
      payload: { ready: true, type: "player.ready" },
      roomId: "room-1",
      sentAtMs: 3,
    }), 3);
    runtime.processCommand("host", createCommandEnvelope({
      commandId: "start",
      payload: { type: "room.start" },
      roomId: "room-1",
      sentAtMs: 4,
    }), 4);
    const before = runtime.getSnapshot().combat?.tick;
    runtime.advanceSimulation(2);
    expect(before).toBe(0);
    expect(runtime.getSnapshot().combat?.tick).toBe(2);
  });
});
