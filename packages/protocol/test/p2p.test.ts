import { createInitialGameState } from "@ningacademy/game-core";
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
});
