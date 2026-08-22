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

  it("despawns a member from authoritative combat only after permanent detach", () => {
    const runtime = HostP2PAuthorityRuntime.create({
      maxPlayers: 8,
      nowMs: 1,
      roomId: "room-1",
      rulesetVersion: "p0",
      seed: "seed",
    });
    runtime.attachMember({ displayName: "Host", memberId: "host" }, 2);
    runtime.attachMember({ displayName: "Peer", memberId: "peer" }, 3);
    for (const memberId of ["host", "peer"] as const) {
      runtime.processCommand(memberId, createCommandEnvelope({
        commandId: `${memberId}-ready`,
        payload: { ready: true, type: "player.ready" },
        roomId: "room-1",
        sentAtMs: 4,
      }), 4);
    }
    runtime.processCommand("host", createCommandEnvelope({
      commandId: "start-two-player",
      payload: { type: "room.start" },
      roomId: "room-1",
      sentAtMs: 5,
    }), 5);
    expect(runtime.getSnapshot().combat?.survivors.peer).toBeDefined();

    runtime.detachMember("peer", 6);

    expect(runtime.getSnapshot().players.peer?.status).toBe("left");
    expect(runtime.getSnapshot().activePlayerIds).not.toContain("peer");
    expect(runtime.getSnapshot().combat?.survivors.peer).toBeUndefined();
    expect(runtime.getSnapshot().combat?.history.every((frame) => frame.survivors.peer === undefined)).toBe(true);
  });

  it("restores the authoritative map, enemy collection, and wave for reconnect or late join", () => {
    const original = HostP2PAuthorityRuntime.create({
      maxPlayers: 8,
      nowMs: 1,
      roomId: "room-world",
      rulesetVersion: "p6",
      seed: "shared-world-seed",
    });
    for (const [index, memberId] of ["host", "peer-a", "peer-b"].entries()) {
      original.attachMember({ displayName: memberId, memberId }, index + 2);
      original.processCommand(memberId, createCommandEnvelope({
        commandId: `ready-${memberId}`,
        payload: { ready: true, type: "player.ready" },
        roomId: "room-world",
        sentAtMs: index + 10,
      }), index + 10);
    }
    original.processCommand("host", createCommandEnvelope({
      commandId: "start-world",
      payload: { type: "room.start" },
      roomId: "room-world",
      sentAtMs: 20,
    }), 20);
    original.advanceSimulation(25);
    const checkpoint = original.getSnapshot();
    expect(Object.keys(checkpoint.combat?.enemies ?? {})).toHaveLength(3);

    const replacement = HostP2PAuthorityRuntime.create({
      nowMs: 100,
      roomId: "room-world",
      rulesetVersion: "p6",
      seed: "ignored-after-restore",
    });
    replacement.restoreCheckpoint(checkpoint);

    expect(replacement.getSnapshot()).toEqual(checkpoint);
    expect(replacement.getSnapshot().combat).toMatchObject({
      enemyRevision: checkpoint.combat?.enemyRevision,
      map: { layoutHash: checkpoint.combat?.map.layoutHash },
      wave: { waveNumber: 1 },
    });
  });

  it("rejects a checkpoint with an invalid enemy or wave revision", () => {
    const runtime = HostP2PAuthorityRuntime.create({
      nowMs: 1,
      roomId: "room-invalid-world",
      rulesetVersion: "p6",
      seed: "seed",
    });
    runtime.attachMember({ displayName: "Host", memberId: "host" }, 2);
    runtime.processCommand("host", createCommandEnvelope({
      commandId: "ready",
      payload: { ready: true, type: "player.ready" },
      roomId: "room-invalid-world",
      sentAtMs: 3,
    }), 3);
    runtime.processCommand("host", createCommandEnvelope({
      commandId: "start",
      payload: { type: "room.start" },
      roomId: "room-invalid-world",
      sentAtMs: 4,
    }), 4);
    const checkpoint = runtime.getSnapshot();
    if (checkpoint.combat === null) throw new Error("Missing combat checkpoint");
    const combat = checkpoint.combat;

    expect(() => runtime.restoreCheckpoint({
      ...checkpoint,
      combat: {
        ...combat,
        wave: { ...combat.wave, revision: -1 },
      },
    })).toThrow("world state is invalid");
  });
});
