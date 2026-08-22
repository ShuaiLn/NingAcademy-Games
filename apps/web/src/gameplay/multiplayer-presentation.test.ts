import {
  advanceGameSimulation,
  createInitialGameState,
  reduceGameCommand,
  type GameCommand,
  type GameState,
} from "@ningacademy/game-core";
import { describe, expect, it } from "vitest";

import { MultiplayerPresentationTimeline } from "./multiplayer-presentation";

function dispatch(state: GameState, playerId: string, commandId: string, command: GameCommand): GameState {
  const result = reduceGameCommand(state, {
    actor: { kind: "user", userId: playerId },
    atMs: 1_100 + state.revision,
    command,
    commandId,
  });
  if (!result.accepted) throw new Error(result.error.message);
  return result.state;
}

function startedState(): GameState {
  let state = createInitialGameState({
    maxPlayers: 8,
    nowMs: 1_000,
    roomId: "presentation-room",
    rulesetVersion: "test",
    seed: "presentation",
  });
  for (const playerId of ["host", "peer", "peer-two"] as const) {
    state = dispatch(state, playerId, `join-${playerId}`, {
      displayName: playerId,
      type: "player.join",
    });
    state = dispatch(state, playerId, `ready-${playerId}`, { ready: true, type: "player.ready" });
  }
  return advanceGameSimulation(dispatch(state, "host", "start", { type: "room.start" })).state;
}

describe("multiplayer presentation timeline", () => {
  it("drops stale snapshots and interpolates remote players and the Thrall", () => {
    const initial = startedState();
    const combat = initial.combat;
    if (combat === null) throw new Error("Missing combat");
    const enemyId = Object.keys(combat.enemies)[0];
    if (enemyId === undefined) throw new Error("Missing enemy");
    const enemy = combat.enemies[enemyId]!;
    const moved: GameState = {
      ...initial,
      revision: initial.revision + 1,
      combat: {
        ...combat,
        enemyRevision: combat.enemyRevision + 1,
        enemies: { ...combat.enemies, [enemyId]: { ...enemy, position: { x: 8, z: -6 } } },
        survivors: {
          ...combat.survivors,
          peer: { ...combat.survivors.peer!, position: { x: 10, z: 4 } },
        },
      },
    };
    const timeline = new MultiplayerPresentationTimeline("host");
    expect(timeline.pushSnapshot(initial, 0)).toBe(true);
    expect(timeline.pushSnapshot(moved, 100)).toBe(true);
    expect(timeline.pushSnapshot(initial, 120)).toBe(false);

    const frame = timeline.sample(150);
    expect(frame?.survivors.peer?.position.x).toBeCloseTo(5);
    expect(frame?.survivors.peer?.position.z).toBeCloseTo(
      ((combat.survivors.peer?.position.z ?? 0) + 4) / 2,
    );
    expect(frame?.enemies[enemyId]?.position.x).toBeCloseTo((enemy.position.x + 8) / 2);
  });

  it("predicts local movement, then reconciles acknowledged input from Host", () => {
    let state = startedState();
    const timeline = new MultiplayerPresentationTimeline("peer");
    expect(timeline.pushSnapshot(state, 0)).toBe(true);
    const before = timeline.sample(0)?.localSurvivor?.position;
    const input = {
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: Math.floor(state.combat?.timeMs ?? 0),
      moveForward: 1,
      moveRight: 0,
      sequence: 1,
    };
    expect(timeline.queueLocalInput(input)).toBe(true);
    expect(timeline.sample(10)?.localSurvivor?.position).not.toEqual(before);
    expect(timeline.pendingInputCount).toBe(1);

    state = dispatch(state, "peer", "move-peer", { type: "combat.input", ...input });
    state = advanceGameSimulation(state).state;
    expect(timeline.pushSnapshot(state, 100)).toBe(true);
    expect(timeline.pendingInputCount).toBe(0);
    expect(timeline.sample(200)?.localSurvivor?.position).toEqual(
      state.combat?.survivors.peer?.position,
    );
  });

  it("adds and removes render entities from authoritative survivor membership", () => {
    const initial = startedState();
    const timeline = new MultiplayerPresentationTimeline("host");
    expect(timeline.pushSnapshot(initial, 0)).toBe(true);
    expect(timeline.sample(100)?.survivors.peer).toBeDefined();

    const left = dispatch(initial, "peer", "leave-peer", { type: "player.leave" });
    expect(timeline.pushSnapshot(left, 100)).toBe(true);
    expect(timeline.sample(200)?.survivors.peer).toBeUndefined();
  });

  it("does not resurrect a despawned enemy from late or stale collection state", () => {
    const initial = startedState();
    const combat = initial.combat;
    if (combat === null) throw new Error("Missing combat");
    const enemyId = Object.keys(combat.enemies)[0];
    if (enemyId === undefined) throw new Error("Missing enemy");
    const remainingEnemies = { ...combat.enemies };
    delete remainingEnemies[enemyId];
    const despawned: GameState = {
      ...initial,
      revision: initial.revision + 1,
      combat: {
        ...combat,
        enemies: remainingEnemies,
        enemyRevision: combat.enemyRevision + 1,
        enemyTombstones: { ...combat.enemyTombstones, [enemyId]: combat.tick + 1 },
      },
    };
    const timeline = new MultiplayerPresentationTimeline("host");
    expect(timeline.pushSnapshot(initial, 0)).toBe(true);
    expect(timeline.pushSnapshot(despawned, 100)).toBe(true);
    expect(timeline.sample(200)?.enemies[enemyId]).toBeUndefined();
    expect(timeline.pushSnapshot(initial, 150)).toBe(false);
    const forgedResurrection: GameState = {
      ...initial,
      revision: despawned.revision + 1,
      combat: { ...combat, enemyRevision: combat.enemyRevision },
    };
    expect(timeline.pushSnapshot(forgedResurrection, 200)).toBe(false);
    expect(timeline.sample(250)?.enemies[enemyId]).toBeUndefined();
  });

  it("rejects a higher room revision carrying stale wave state", () => {
    const initial = startedState();
    const combat = initial.combat;
    if (combat === null) throw new Error("Missing combat");
    const advancedWave: GameState = {
      ...initial,
      revision: initial.revision + 1,
      combat: { ...combat, wave: { ...combat.wave, revision: combat.wave.revision + 1 } },
    };
    const staleWave: GameState = { ...initial, revision: advancedWave.revision + 1 };
    const timeline = new MultiplayerPresentationTimeline("host");
    expect(timeline.pushSnapshot(initial, 0)).toBe(true);
    expect(timeline.pushSnapshot(advancedWave, 100)).toBe(true);
    expect(timeline.pushSnapshot(staleWave, 200)).toBe(false);
  });

  it("reconstructs the same map, wave, and enemy collection for Host and multiple Peers", () => {
    const state = advanceGameSimulation(startedState(), 24).state;
    const expectedEnemyIds = Object.keys(state.combat?.enemies ?? {}).sort();
    expect(expectedEnemyIds.length).toBeGreaterThan(1);

    const frames = ["host", "peer", "peer-two"].map((playerId) => {
      const timeline = new MultiplayerPresentationTimeline(playerId);
      expect(timeline.pushSnapshot(state, 100)).toBe(true);
      return timeline.sample(200);
    });

    expect(frames.every((frame) => frame?.combat.map.layoutHash === state.combat?.map.layoutHash))
      .toBe(true);
    expect(frames.map((frame) => Object.keys(frame?.enemies ?? {}).sort()))
      .toEqual([expectedEnemyIds, expectedEnemyIds, expectedEnemyIds]);
    expect(frames.map((frame) => frame?.combat.wave.enemiesRemaining))
      .toEqual([3, 3, 3]);
  });

  it("rejects an otherwise newer snapshot from a different room", () => {
    const initial = startedState();
    const timeline = new MultiplayerPresentationTimeline("host");
    expect(timeline.pushSnapshot(initial, 0)).toBe(true);
    expect(timeline.pushSnapshot({
      ...initial,
      revision: initial.revision + 1,
      roomId: "forged-room",
    }, 100)).toBe(false);
  });
});
