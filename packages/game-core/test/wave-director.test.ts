import { describe, expect, it } from "vitest";

import {
  WAVE_DIRECTOR_RULES,
  advanceCombatTicks,
  createCombatState,
  createWaveStartedEvent,
  despawnEnemyFromCollection,
  spawnEnemyIntoCollection,
  type CombatEvent,
  type CombatState,
} from "../src/index.js";

function initialCombat(): CombatState {
  return createCombatState({
    biome: "house",
    playerIds: ["host", "peer-a", "peer-b"],
    seed: "wave-room-seed",
    startedAtMs: 1_000,
  });
}

function spawnWholeFirstWave(): CombatState {
  return advanceCombatTicks(initialCombat(), 25).state;
}

describe("authoritative Wave Spawn Director", () => {
  it("starts Wave 1 with an authoritative deterministic schedule", () => {
    const combat = initialCombat();

    expect(combat.wave).toMatchObject({
      enemiesRemaining: 3,
      phase: "spawning",
      spawnCursor: 0,
      waveKind: "standard",
      waveNumber: 1,
    });
    expect(createWaveStartedEvent(combat)).toMatchObject({
      enemyCount: 3,
      tick: 0,
      type: "combat.wave_started",
      waveKind: "standard",
      waveNumber: 1,
      waveRevision: combat.wave.revision,
    });
  });

  it("spawns multiple Thralls with deterministic stable entity ids", () => {
    const host = spawnWholeFirstWave();
    const replay = spawnWholeFirstWave();
    const ids = Object.keys(host.enemies).sort();

    expect(ids).toHaveLength(WAVE_DIRECTOR_RULES.firstWaveEnemyCount);
    expect(ids).toEqual(Object.keys(replay.enemies).sort());
    expect(ids).toEqual(host.wave.spawnSchedule.map((entry) => entry.entityId).sort());
    expect(Object.entries(host.enemies).every(([entityId, enemy]) => (
      enemy.entityId === entityId && enemy.waveNumber === 1
    ))).toBe(true);
  });

  it("rejects duplicate and tombstoned Host spawn ids", () => {
    const combat = advanceCombatTicks(initialCombat()).state;
    const enemy = Object.values(combat.enemies)[0];
    if (enemy === undefined) throw new Error("Missing scheduled enemy");

    expect(spawnEnemyIntoCollection(combat.enemies, combat.enemyTombstones, enemy))
      .toMatchObject({ accepted: false, reason: "duplicate_entity_id" });
    const removed = despawnEnemyFromCollection(
      combat.enemies,
      combat.enemyTombstones,
      enemy.entityId,
      combat.tick,
    );
    expect(spawnEnemyIntoCollection(removed.enemies, removed.tombstones, enemy))
      .toMatchObject({ accepted: false, reason: "resurrected_entity_id" });
  });

  it("cannot complete a wave while authoritative enemies remain", () => {
    const combat = spawnWholeFirstWave();
    expect(combat.wave.phase).toBe("combat");
    expect(combat.wave.enemiesRemaining).toBe(3);

    const advanced = advanceCombatTicks(combat);
    expect(advanced.state.wave.phase).toBe("combat");
    expect(advanced.state.wave.enemiesRemaining).toBe(3);
    expect(advanced.events.some((event) => event.type === "combat.wave_completed")).toBe(false);
  });

  it("despawns all killed enemies consistently, enters break, then starts Wave 2", () => {
    const combat = spawnWholeFirstWave();
    const deadEnemies = Object.fromEntries(Object.entries(combat.enemies).map(([entityId, enemy]) => [
      entityId,
      { ...enemy, alive: false, animationState: "dead" as const, despawnAtTick: combat.tick + 1, hp: 0 },
    ]));
    const killedState: CombatState = { ...combat, enemies: deadEnemies };
    const completed = advanceCombatTicks(killedState);
    const despawnEvents = completed.events.filter((event): event is Extract<CombatEvent, {
      type: "combat.enemy_despawned";
    }> => event.type === "combat.enemy_despawned");

    expect(despawnEvents.map((event) => event.entityId).sort())
      .toEqual(Object.keys(deadEnemies).sort());
    expect(completed.state.enemies).toEqual({});
    expect(Object.keys(completed.state.enemyTombstones).sort())
      .toEqual(Object.keys(deadEnemies).sort());
    expect(completed.state.wave).toMatchObject({ enemiesRemaining: 0, phase: "break", waveNumber: 1 });
    expect(completed.events).toContainEqual(expect.objectContaining({
      type: "combat.wave_completed",
      waveNumber: 1,
    }));

    let next = completed;
    for (let batch = 0; batch < 3; batch += 1) next = advanceCombatTicks(next.state, 30);
    expect(next.state.wave).toMatchObject({
      enemiesRemaining: 5,
      phase: "spawning",
      waveNumber: 2,
    });
    expect(next.events).toContainEqual(expect.objectContaining({
      enemyCount: 5,
      type: "combat.wave_started",
      waveNumber: 2,
    }));
  });
});
