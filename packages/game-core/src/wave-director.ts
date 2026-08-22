import { createRandomState, nextFloat, nextUint32, randomInt } from "./prng.js";
import type {
  CombatState,
  ThrallState,
  WaveDirectorState,
  WaveSpawnScheduleEntry,
} from "./combat-types.js";
import type { CombatMapLayout } from "./map-layout.js";

export const WAVE_DIRECTOR_RULES = {
  breakTicks: 90,
  enemyDespawnTicks: 18,
  enemySpawnIntervalTicks: 12,
  firstWaveEnemyCount: 3,
  hpIncreasePerWave: 0.15,
  maxEnemiesPerWave: 15,
  additionalEnemiesPerWave: 2,
} as const;

export interface WaveCreationResult {
  readonly rng: CombatState["rng"];
  readonly wave: WaveDirectorState;
}

function enemyCountForWave(waveNumber: number): number {
  return Math.min(
    WAVE_DIRECTOR_RULES.maxEnemiesPerWave,
    WAVE_DIRECTOR_RULES.firstWaveEnemyCount
      + (waveNumber - 1) * WAVE_DIRECTOR_RULES.additionalEnemiesPerWave,
  );
}

export function createWaveDirectorState(
  rng: CombatState["rng"],
  waveNumber: number,
  startedAtTick: number,
  previousRevision = 0,
): WaveCreationResult {
  if (!Number.isSafeInteger(waveNumber) || waveNumber < 1) {
    throw new RangeError("waveNumber must be a positive safe integer");
  }
  const waveSeedDraw = nextUint32(rng);
  let scheduleRng = createRandomState(waveSeedDraw.value);
  const spawnSchedule: WaveSpawnScheduleEntry[] = [];
  const enemyCount = enemyCountForWave(waveNumber);
  for (let index = 0; index < enemyCount; index += 1) {
    const zoneDraw = randomInt(scheduleRng, 4);
    const entrySeedDraw = nextUint32(zoneDraw.state);
    scheduleRng = entrySeedDraw.state;
    spawnSchedule.push({
      entityId: `thrall:w${waveNumber}:e${index}:${entrySeedDraw.value.toString(16).padStart(8, "0")}`,
      spawnAtTick: startedAtTick + 1 + index * WAVE_DIRECTOR_RULES.enemySpawnIntervalTicks,
      spawnSeed: entrySeedDraw.value,
      spawnZoneId: ["enemy-north", "enemy-east", "enemy-south", "enemy-west"][zoneDraw.value]!,
    });
  }

  return {
    rng: waveSeedDraw.state,
    wave: {
      breakEndsAtTick: null,
      difficultyMultiplier: 1 + (waveNumber - 1) * WAVE_DIRECTOR_RULES.hpIncreasePerWave,
      enemiesRemaining: enemyCount,
      phase: "spawning",
      revision: previousRevision + 1,
      spawnCursor: 0,
      spawnSchedule,
      spawnSeed: waveSeedDraw.value,
      startedAtTick,
      waveKind: "standard",
      waveNumber,
    },
  };
}

export function waveSpawnPosition(
  layout: CombatMapLayout,
  entry: WaveSpawnScheduleEntry,
): { readonly x: number; readonly z: number } {
  const zone = layout.enemySpawnZones.find((candidate) => candidate.id === entry.spawnZoneId);
  if (zone === undefined) throw new Error(`Unknown enemy spawn zone: ${entry.spawnZoneId}`);
  const xDraw = nextFloat(createRandomState(entry.spawnSeed));
  const zDraw = nextFloat(xDraw.state);
  return {
    x: Math.round((zone.center.x + (xDraw.value * 2 - 1) * zone.halfExtents.x * 0.7) * 1_000) / 1_000,
    z: Math.round((zone.center.z + (zDraw.value * 2 - 1) * zone.halfExtents.z * 0.7) * 1_000) / 1_000,
  };
}

export function createScheduledThrall(
  layout: CombatMapLayout,
  entry: WaveSpawnScheduleEntry,
  wave: WaveDirectorState,
  tick: number,
  baseMaxHp: number,
): ThrallState {
  const maxHp = Math.round(baseMaxHp * wave.difficultyMultiplier);
  return {
    alive: true,
    animationRevision: 1,
    animationState: "spawning",
    animationUntilTick: tick + 15,
    attackReadyTick: tick + 15,
    despawnAtTick: null,
    entityId: entry.entityId,
    hp: maxHp,
    maxHp,
    position: waveSpawnPosition(layout, entry),
    spawnTick: tick,
    spawnZoneId: entry.spawnZoneId,
    targetPlayerId: null,
    velocity: { x: 0, z: 0 },
    waveNumber: wave.waveNumber,
  };
}

export type EnemySpawnResult =
  | {
      readonly accepted: true;
      readonly enemies: Readonly<Record<string, ThrallState>>;
    }
  | {
      readonly accepted: false;
      readonly enemies: Readonly<Record<string, ThrallState>>;
      readonly reason: "duplicate_entity_id" | "resurrected_entity_id";
    };

/** Host-owned collection seam. There is intentionally no GameCommand that can
 * call this function through a peer payload. */
export function spawnEnemyIntoCollection(
  enemies: Readonly<Record<string, ThrallState>>,
  tombstones: Readonly<Record<string, number>>,
  enemy: ThrallState,
): EnemySpawnResult {
  if (enemies[enemy.entityId] !== undefined) {
    return { accepted: false, enemies, reason: "duplicate_entity_id" };
  }
  if (tombstones[enemy.entityId] !== undefined) {
    return { accepted: false, enemies, reason: "resurrected_entity_id" };
  }
  return { accepted: true, enemies: { ...enemies, [enemy.entityId]: enemy } };
}

export function despawnEnemyFromCollection(
  enemies: Readonly<Record<string, ThrallState>>,
  tombstones: Readonly<Record<string, number>>,
  entityId: string,
  tick: number,
): {
  readonly enemies: Readonly<Record<string, ThrallState>>;
  readonly tombstones: Readonly<Record<string, number>>;
} {
  if (enemies[entityId] === undefined) return { enemies, tombstones };
  const nextEnemies: Record<string, ThrallState> = { ...enemies };
  delete nextEnemies[entityId];
  const tombstoneEntries = [...Object.entries(tombstones), [entityId, tick] as const]
    .sort((left, right) => left[1] - right[1])
    .slice(-256);
  return { enemies: nextEnemies, tombstones: Object.fromEntries(tombstoneEntries) };
}
