import { describe, expect, it } from "vitest";

import {
  createInitialGameState,
  reduceGameCommand,
  type GameCommand,
  type GameState,
} from "../src/index.js";

function dispatch(
  state: GameState,
  commandId: string,
  userId: string,
  command: GameCommand,
): ReturnType<typeof reduceGameCommand> {
  return reduceGameCommand(state, {
    commandId,
    atMs: 1_000 + state.revision,
    actor: { kind: "user", userId },
    command,
  });
}

function accepted(result: ReturnType<typeof reduceGameCommand>): GameState {
  expect(result.accepted).toBe(true);
  if (!result.accepted) {
    throw new Error(result.error.message);
  }
  return result.state;
}

describe("game state reducer", () => {
  it("derives player identity only from the authenticated actor", () => {
    const initial = createInitialGameState({
      roomId: "room-a",
      rulesetVersion: "test-v1",
      seed: 7,
      nowMs: 100,
    });
    const result = dispatch(initial, "cmd-1", "auth-user-42", {
      type: "player.join",
      displayName: "Student",
    });

    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.state.players["auth-user-42"]?.displayName).toBe("Student");
      expect(result.state.hostPlayerId).toBe("auth-user-42");
    }
  });

  it("requires every player to be ready and only lets the host start", () => {
    let state = createInitialGameState({
      roomId: "room-b",
      rulesetVersion: "test-v1",
      seed: "stable-seed",
      nowMs: 100,
    });
    state = accepted(dispatch(state, "join-a", "alice", { type: "player.join", displayName: "Alice" }));
    state = accepted(dispatch(state, "join-b", "bob", { type: "player.join", displayName: "Bob" }));
    state = accepted(dispatch(state, "ready-a", "alice", { type: "player.ready", ready: true }));

    const tooEarly = dispatch(state, "start-early", "alice", { type: "room.start" });
    expect(tooEarly.accepted).toBe(false);
    if (!tooEarly.accepted) {
      expect(tooEarly.error.code).toBe("PLAYERS_NOT_READY");
    }

    state = accepted(dispatch(state, "ready-b", "bob", { type: "player.ready", ready: true }));
    const nonHost = dispatch(state, "start-bob", "bob", { type: "room.start" });
    expect(nonHost.accepted).toBe(false);
    if (!nonHost.accepted) {
      expect(nonHost.error.code).toBe("NOT_HOST");
    }

    const started = dispatch(state, "start-alice", "alice", { type: "room.start" });
    expect(started.accepted).toBe(true);
    if (started.accepted) {
      expect(started.state.status).toBe("running");
      expect([...started.state.turnOrder].sort()).toEqual(["alice", "bob"]);
      expect(started.state.rng.draws).toBe(1);
    }
  });

  it("treats a repeated command id as an idempotent retry", () => {
    const initial = createInitialGameState({
      roomId: "room-c",
      rulesetVersion: "test-v1",
      seed: 1,
      nowMs: 100,
    });
    const first = dispatch(initial, "same-command", "alice", {
      type: "player.join",
      displayName: "Alice",
    });
    const state = accepted(first);
    const retry = dispatch(state, "same-command", "alice", {
      type: "player.join",
      displayName: "Changed",
    });

    expect(retry.accepted).toBe(true);
    if (retry.accepted) {
      expect(retry.duplicate).toBe(true);
      expect(retry.state).toBe(state);
      expect(retry.events).toEqual([]);
    }
  });

  it("ends a running room when its final active player leaves", () => {
    let state = createInitialGameState({
      roomId: "room-d",
      rulesetVersion: "test-v1",
      seed: 1,
      nowMs: 100,
    });
    state = accepted(dispatch(state, "join", "alice", { type: "player.join", displayName: "Alice" }));
    state = accepted(dispatch(state, "ready", "alice", { type: "player.ready", ready: true }));
    state = accepted(dispatch(state, "start", "alice", { type: "room.start" }));
    const result = dispatch(state, "leave", "alice", { type: "player.leave" });

    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(result.state.status).toBe("ended");
      expect(result.state.endReason).toBe("empty");
      expect(result.events.at(-1)).toEqual({ type: "room.ended", reason: "empty" });
    }
  });
});
