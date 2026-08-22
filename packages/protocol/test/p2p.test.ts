import { createCombatState, createInitialGameState } from "@ningacademy/game-core";
import { describe, expect, it } from "vitest";

import {
  MAX_P2P_PACKET_BYTES,
  PROTOCOL_VERSION,
  decodeP2PControlPacket,
  decodeP2PRealtimePacket,
  encodeP2PPacket,
} from "../src/index.js";

describe("WebRTC packet contract", () => {
  it("decodes host snapshots and rejects a peer-authored message kind", () => {
    const state = createInitialGameState({
      nowMs: 1,
      roomId: "room-1",
      rulesetVersion: "p0",
      seed: "seed",
    });
    const packet = encodeP2PPacket({
      messageType: "game.snapshot",
      protocolVersion: PROTOCOL_VERSION,
      revision: state.revision,
      roomId: state.roomId,
      state,
      topologyEpoch: 1,
    });
    expect(decodeP2PRealtimePacket(packet)).toMatchObject({ messageType: "game.snapshot" });
    expect(decodeP2PControlPacket(JSON.stringify({
      messageType: "game.authoritative_override",
      protocolVersion: PROTOCOL_VERSION,
      state,
    }))).toBeNull();
  });

  it("rejects oversized packets before JSON decoding", () => {
    expect(decodeP2PControlPacket("x".repeat(MAX_P2P_PACKET_BYTES + 1))).toBeNull();
  });

  it("requires topology epoch and rejects a divergent deterministic map hash", () => {
    const state = createInitialGameState({
      nowMs: 1,
      roomId: "room-1",
      rulesetVersion: "p0",
      seed: "seed",
    });
    expect(decodeP2PRealtimePacket(JSON.stringify({
      messageType: "game.snapshot",
      protocolVersion: PROTOCOL_VERSION,
      revision: state.revision,
      roomId: state.roomId,
      state,
    }))).toBeNull();

    const combat = createCombatState({
      biome: "house",
      playerIds: ["host"],
      seed: "seed",
      startedAtMs: 1,
    });
    const corruptState = {
      ...state,
      combat: { ...combat, map: { ...combat.map, layoutHash: "fnv1a32:00000000" } },
      status: "running" as const,
    };
    expect(decodeP2PRealtimePacket(JSON.stringify({
      messageType: "game.snapshot",
      protocolVersion: PROTOCOL_VERSION,
      revision: corruptState.revision,
      roomId: corruptState.roomId,
      state: corruptState,
      topologyEpoch: 1,
    }))).toBeNull();
  });
});
