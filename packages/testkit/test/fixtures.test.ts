import { describe, expect, it } from "vitest";

import {
  TEST_USERS,
  createReadyLobbyFixture,
  createStartedCombatFixture,
  createStartedRoomFixture,
  createTestCommandEnvelope,
} from "../src/index.js";

describe("testkit fixtures", () => {
  it("creates a ready two-player lobby", () => {
    const state = createReadyLobbyFixture();

    expect(state.status).toBe("lobby");
    expect(state.activePlayerIds).toEqual([TEST_USERS.alice.userId, TEST_USERS.bob.userId]);
    expect(state.activePlayerIds.every((id) => state.players[id]?.ready)).toBe(true);
  });

  it("creates a server-authoritative combat fixture", () => {
    const fixture = createStartedCombatFixture();

    expect(fixture.state.status).toBe("running");
    expect(fixture.state.combat?.survivors[fixture.playerId]).toBeDefined();
    expect(Object.values(fixture.state.combat?.enemies ?? {})).toHaveLength(1);
    expect(Object.values(fixture.state.combat?.enemies ?? {})[0]?.entityId).toMatch(/^thrall:w1:e0:/u);
    expect(fixture.state.combat?.history).toHaveLength(2);
  });

  it("creates a deterministic started room", () => {
    const left = createStartedRoomFixture();
    const right = createStartedRoomFixture();

    expect(left.status).toBe("running");
    expect(left.turnOrder).toEqual(right.turnOrder);
    expect(left.rng).toEqual(right.rng);
  });

  it("creates a protocol-valid command fixture without identity", () => {
    const envelope = createTestCommandEnvelope({ type: "player.join", displayName: "Alice" });

    expect(envelope.payload).toEqual({ type: "player.join", displayName: "Alice" });
    expect(envelope).not.toHaveProperty("userId");
    expect(envelope).not.toHaveProperty("actor");
  });
});
