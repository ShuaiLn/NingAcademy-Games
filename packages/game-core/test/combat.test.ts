import { describe, expect, it } from "vitest";

import {
  COMBAT_REWIND_WINDOW_MS,
  COMBAT_RULES,
  COMBAT_TICK_MS,
  advanceGameSimulation,
  createInitialGameState,
  isValidMovementTransition,
  reduceGameCommand,
  type CombatEvent,
  type CombatSurvivorState,
  type GameCommand,
  type GameState,
} from "../src/index.js";

const PLAYER_ID = "authenticated-player";

function dispatch(
  state: GameState,
  commandId: string,
  command: GameCommand,
  atMs = Math.floor(state.combat?.timeMs ?? (1_001 + state.revision)),
) {
  return reduceGameCommand(state, {
    actor: { kind: "user", userId: PLAYER_ID },
    atMs,
    command,
    commandId,
  });
}

function accepted(result: ReturnType<typeof reduceGameCommand>): GameState {
  expect(result.accepted).toBe(true);
  if (!result.accepted) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.state;
}

function startedState(seed = "combat-test-seed"): GameState {
  let state = createInitialGameState({
    maxPlayers: 1,
    nowMs: 1_000,
    roomId: "combat-room",
    rulesetVersion: "p1-test",
    seed,
  });
  state = accepted(dispatch(state, "join", { type: "player.join", displayName: "Player" }));
  state = accepted(dispatch(state, "ready", { type: "player.ready", ready: true }));
  state = accepted(dispatch(state, "start", { type: "room.start" }));
  expect(state.combat).not.toBeNull();
  return state;
}

function aimAt(
  state: GameState,
  target: { readonly x: number; readonly z: number },
  sequence: number,
): GameState {
  const combat = state.combat;
  if (combat === null) {
    throw new Error("Missing combat");
  }
  const survivor = combat.survivors[PLAYER_ID];
  if (survivor === undefined) {
    throw new Error("Missing survivor");
  }
  const dx = target.x - survivor.position.x;
  const dz = target.z - survivor.position.z;
  const horizontal = Math.hypot(dx, dz);
  return accepted(dispatch(state, `aim-${sequence}`, {
    type: "combat.input",
    aimPitch: Math.atan2(
      COMBAT_RULES.thrallCoreHeight - COMBAT_RULES.survivorEyeHeight,
      horizontal,
    ),
    aimYaw: Math.atan2(dx, dz),
    clientTimeMs: Math.floor(combat.timeMs),
    moveForward: 0,
    moveRight: 0,
    sequence,
  }));
}

function eventsOf(result: ReturnType<typeof reduceGameCommand>): readonly CombatEvent[] {
  if (!result.accepted) {
    throw new Error(result.error.message);
  }
  return result.events.filter((event): event is CombatEvent => event.type.startsWith("combat."));
}

describe("P1 authoritative combat", () => {
  it("accepts intent but rejects oversized movement and forged teleport fields", () => {
    const state = startedState();
    const combat = state.combat;
    if (combat === null) {
      throw new Error("Missing combat");
    }

    const oversized = dispatch(state, "oversized", {
      type: "combat.input",
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: Math.floor(combat.timeMs),
      moveForward: 10,
      moveRight: 0,
      sequence: 1,
    });
    expect(oversized).toMatchObject({ accepted: false, error: { code: "INVALID_MOVEMENT" } });

    const forgedTeleport = dispatch(state, "teleport", {
      type: "combat.input",
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: Math.floor(combat.timeMs),
      moveForward: 0,
      moveRight: 0,
      position: { x: 999, z: 999 },
      sequence: 1,
    } as unknown as GameCommand);
    expect(forgedTeleport).toMatchObject({
      accepted: false,
      error: { code: "INVALID_COMBAT_COMMAND" },
    });

    const survivor = combat.survivors[PLAYER_ID];
    if (survivor === undefined) {
      throw new Error("Missing survivor");
    }
    const teleported: CombatSurvivorState = {
      ...survivor,
      position: { x: survivor.position.x + 100, z: survivor.position.z },
    };
    expect(isValidMovementTransition(survivor, teleported, COMBAT_TICK_MS)).toBe(false);
  });

  it("enforces acceleration while integrating accepted input at 30 Hz", () => {
    let state = startedState();
    const timeMs = Math.floor(state.combat?.timeMs ?? 0);
    state = accepted(dispatch(state, "move", {
      type: "combat.input",
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: timeMs,
      moveForward: 1,
      moveRight: 0,
      sequence: 1,
    }));
    const before = state.combat?.survivors[PLAYER_ID];
    state = advanceGameSimulation(state).state;
    const after = state.combat?.survivors[PLAYER_ID];

    expect(before).toBeDefined();
    expect(after).toBeDefined();
    if (before !== undefined && after !== undefined) {
      expect(Math.hypot(after.velocity.x, after.velocity.z)).toBeLessThanOrEqual(
        COMBAT_RULES.survivorAcceleration / 30 + 0.001,
      );
      expect(isValidMovementTransition(before, after, COMBAT_TICK_MS)).toBe(true);
    }
  });

  it("makes repeated command ids idempotent and rejects repeated input sequences", () => {
    const state = startedState();
    const combatTime = Math.floor(state.combat?.timeMs ?? 0);
    const command: GameCommand = {
      type: "combat.input",
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: combatTime,
      moveForward: 0,
      moveRight: 0,
      sequence: 1,
    };
    const first = dispatch(state, "input-once", command);
    const acceptedState = accepted(first);
    const retry = dispatch(acceptedState, "input-once", command);
    expect(retry).toMatchObject({ accepted: true, duplicate: true, events: [] });
    if (retry.accepted) {
      expect(retry.state).toBe(acceptedState);
    }

    const replay = dispatch(acceptedState, "different-command", command);
    expect(replay).toMatchObject({
      accepted: false,
      error: { code: "INPUT_SEQUENCE_REPLAY" },
    });
  });

  it("rejects expired input frames instead of applying delayed movement", () => {
    let state = startedState();
    state = advanceGameSimulation(state, 30).state;
    state = advanceGameSimulation(state, 1).state;
    const stale = dispatch(state, "stale-input", {
      type: "combat.input",
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: Math.floor((state.combat?.timeMs ?? 0) - COMBAT_RULES.inputExpiryMs - 1),
      moveForward: 1,
      moveRight: 0,
      sequence: 1,
    });

    expect(stale).toMatchObject({ accepted: false, error: { code: "INPUT_EXPIRED" } });
    expect(state.combat?.survivors[PLAYER_ID]?.velocity).toEqual({ x: 0, z: 0 });
  });

  it("rewinds a moving Thrall for a shot received around 150 ms later", () => {
    let state = startedState();
    const combat = state.combat;
    if (combat === null) {
      throw new Error("Missing combat");
    }
    const historicalPosition = combat.thrall.position;
    const shotTimeMs = Math.floor(combat.timeMs);
    state = aimAt(state, historicalPosition, 1);
    state = advanceGameSimulation(state, 5).state;
    expect(state.combat?.thrall.position).not.toEqual(historicalPosition);

    const fired = dispatch(state, "delayed-shot", {
      type: "combat.fire",
      clientShotTimeMs: shotTimeMs,
      shotSequence: 1,
    });
    expect(eventsOf(fired)).toContainEqual(expect.objectContaining({
      type: "combat.shot_fired",
      evaluatedAtMs: shotTimeMs,
      hit: true,
      rewindClamped: false,
    }));
    if (fired.accepted) {
      expect(fired.state.combat?.thrall.hp).toBe(50);
    }
  });

  it("clamps an over-old shot to bounded history without trusting its target", () => {
    let state = startedState();
    state = advanceGameSimulation(state, 10).state;
    const combat = state.combat;
    if (combat === null) {
      throw new Error("Missing combat");
    }
    state = aimAt(state, combat.thrall.position, 1);
    const fired = dispatch(state, "old-shot", {
      type: "combat.fire",
      clientShotTimeMs: 0,
      shotSequence: 1,
    });
    const shot = eventsOf(fired).find((event) => event.type === "combat.shot_fired");

    expect(shot).toMatchObject({ type: "combat.shot_fired", rewindClamped: true });
    if (shot?.type === "combat.shot_fired") {
      expect(shot.evaluatedAtMs).toBeGreaterThanOrEqual(combat.timeMs - COMBAT_REWIND_WINDOW_MS);
    }
    expect(combat.history[0]?.timeMs).toBeGreaterThanOrEqual(
      combat.timeMs - COMBAT_REWIND_WINDOW_MS,
    );
  });

  it("owns damage, kill, no-gore cue, Thrall respawn, and rifle reload on the server", () => {
    let state = startedState();
    let combat = state.combat;
    if (combat === null) {
      throw new Error("Missing combat");
    }
    state = aimAt(state, combat.thrall.position, 1);
    let fired = dispatch(state, "shot-1", {
      type: "combat.fire",
      clientShotTimeMs: Math.floor(combat.timeMs),
      shotSequence: 1,
    });
    state = accepted(fired);
    state = advanceGameSimulation(state, COMBAT_RULES.rifleFireIntervalTicks).state;
    combat = state.combat;
    if (combat === null) {
      throw new Error("Missing combat");
    }
    state = aimAt(state, combat.thrall.position, 2);
    fired = dispatch(state, "shot-2", {
      type: "combat.fire",
      clientShotTimeMs: Math.floor(combat.timeMs),
      shotSequence: 2,
    });
    const events = eventsOf(fired);
    expect(events).toContainEqual(expect.objectContaining({
      type: "combat.entity_killed",
      entityId: "thrall-0",
      killerPlayerId: PLAYER_ID,
    }));
    const deathCue = events.find((event) => event.type === "combat.death_cue");
    expect(deathCue).toEqual(expect.objectContaining({
      type: "combat.death_cue",
      biome: "house",
      entityId: "thrall-0",
    }));
    expect(JSON.stringify(deathCue)).not.toMatch(/blood|gore|corpse|fragment|shard/i);

    state = accepted(fired);
    state = advanceGameSimulation(state, COMBAT_RULES.thrallRespawnTicks).state;
    expect(state.combat?.thrall).toMatchObject({ alive: true, generation: 1, hp: 100 });

    // Two shots consumed ammunition; reload completion is simulation-owned.
    state = accepted(dispatch(state, "reload", { type: "combat.reload" }));
    expect(state.combat?.survivors[PLAYER_ID]?.rifle.reloadCompleteTick).not.toBeNull();
    state = advanceGameSimulation(state, 30).state;
    state = advanceGameSimulation(state, 15).state;
    expect(state.combat?.survivors[PLAYER_ID]?.rifle).toMatchObject({
      ammo: COMBAT_RULES.rifleMagazineSize,
      reloadCompleteTick: null,
    });
  });

  it("server AI damages, kills, and respawns a survivor", () => {
    let state = startedState();
    const combat = state.combat;
    const survivor = combat?.survivors[PLAYER_ID];
    if (combat === null || combat === undefined || survivor === undefined) {
      throw new Error("Missing combat fixture");
    }
    state = {
      ...state,
      combat: {
        ...combat,
        survivors: { ...combat.survivors, [PLAYER_ID]: { ...survivor, hp: 8 } },
        thrall: { ...combat.thrall, attackReadyTick: combat.tick, position: { x: 0, z: 1 } },
      },
    };
    const killed = advanceGameSimulation(state);
    expect(killed.events).toContainEqual(expect.objectContaining({
      type: "combat.entity_killed",
      entityId: PLAYER_ID,
      entityKind: "survivor",
    }));
    expect(killed.state.combat?.survivors[PLAYER_ID]?.alive).toBe(false);

    state = advanceGameSimulation(killed.state, 30).state;
    const respawned = advanceGameSimulation(state, 30);
    expect(respawned.state.combat?.survivors[PLAYER_ID]?.alive).toBe(true);
    expect(respawned.state.combat?.survivors[PLAYER_ID]?.hp).toBeGreaterThan(0);
    expect(respawned.events).toContainEqual(expect.objectContaining({
      type: "combat.entity_respawned",
      entityId: PLAYER_ID,
    }));
  });

  it("replays seeded AI and generated events from the same command log", () => {
    const run = (): { readonly events: readonly CombatEvent[]; readonly state: GameState } => {
      let state = startedState("replay-seed");
      const events: CombatEvent[] = [];
      for (let batch = 0; batch < 4; batch += 1) {
        const advanced = advanceGameSimulation(state, 30);
        state = advanced.state;
        events.push(...advanced.events);
      }
      return { events, state };
    };

    const left = run();
    const right = run();
    expect(left.events).toEqual(right.events);
    expect(left.state.combat).toEqual(right.state.combat);
  });
});
