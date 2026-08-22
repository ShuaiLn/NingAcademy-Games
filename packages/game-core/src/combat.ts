import { createRandomState, nextUint32 } from "./prng.js";
import {
  createDeterministicGreyboxMap,
  moveWithinCombatMap,
  type CombatMapLayout,
} from "./map-layout.js";
import {
  WAVE_DIRECTOR_RULES,
  createScheduledThrall,
  createWaveDirectorState,
  despawnEnemyFromCollection,
  spawnEnemyIntoCollection,
} from "./wave-director.js";
import {
  COMBAT_REWIND_WINDOW_MS,
  COMBAT_TICK_MS,
  COMBAT_TICK_RATE,
  type CombatBiome,
  type CombatCommand,
  type CombatEvent,
  type CombatHistoryFrame,
  type CombatHistorySurvivor,
  type CombatReduction,
  type CombatRuleErrorCode,
  type CombatSimulationResult,
  type CombatState,
  type CombatSurvivorState,
  type CombatVector2,
  type QuantizedCombatPosition,
  type SurvivorInputState,
  type ThrallState,
  type WaveDirectorState,
} from "./combat-types.js";

export const COMBAT_RULES = {
  historyMs: COMBAT_REWIND_WINDOW_MS,
  inputExpiryMs: 1_000,
  maxAimPitch: 1.35,
  rifleDamage: 50,
  rifleFireIntervalTicks: 6,
  rifleMagazineSize: 12,
  rifleRange: 40,
  rifleReloadTicks: 45,
  survivorAcceleration: 24,
  survivorEyeHeight: 1.6,
  survivorMaxSpeed: 5,
  survivorRadius: 0.4,
  survivorRespawnTicks: 60,
  thrallAttackDamage: 8,
  thrallAttackIntervalTicks: 24,
  thrallAttackRange: 1.25,
  thrallCoreHeight: 1.05,
  thrallHitRadius: 0.8,
  thrallMaxHp: 100,
  thrallRadius: 0.8,
  thrallSpeed: 2.4,
} as const;

const POSITION_QUANTIZATION = 1_000;
const DEATH_CUE_CENTIMETERS = 100;

function exactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isSafeSequence(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafeTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isCombatCommandShape(value: unknown): value is CombatCommand {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const command = value as Readonly<Record<string, unknown>>;
  switch (command.type) {
    case "combat.input":
      return (
        exactKeys(command, [
          "type",
          "sequence",
          "clientTimeMs",
          "moveForward",
          "moveRight",
          "aimYaw",
          "aimPitch",
        ]) &&
        isSafeSequence(command.sequence) &&
        isSafeTimestamp(command.clientTimeMs) &&
        isFiniteNumber(command.moveForward) &&
        isFiniteNumber(command.moveRight) &&
        isFiniteNumber(command.aimYaw) &&
        isFiniteNumber(command.aimPitch)
      );
    case "combat.fire":
      return (
        exactKeys(command, ["type", "shotSequence", "clientShotTimeMs"]) &&
        isSafeSequence(command.shotSequence) &&
        isSafeTimestamp(command.clientShotTimeMs)
      );
    case "combat.reload":
      return exactKeys(command, ["type"]);
    default:
      return false;
  }
}

function quantize(value: number): number {
  return Math.round(value * POSITION_QUANTIZATION) / POSITION_QUANTIZATION;
}

function quantizeVector(position: CombatVector2): CombatVector2 {
  return { x: quantize(position.x), z: quantize(position.z) };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function initialSurvivor(
  playerId: string,
  index: number,
  layout: CombatMapLayout,
): CombatSurvivorState {
  const spawnPointIndex = index % layout.playerSpawnPoints.length;
  const position = layout.playerSpawnPoints[spawnPointIndex] ?? layout.playerSpawnZone.center;

  return {
    alive: true,
    hp: 100,
    kills: 0,
    lastShotSequence: -1,
    maxHp: 100,
    playerId,
    position: quantizeVector(position),
    respawnAtTick: null,
    rifle: {
      ammo: COMBAT_RULES.rifleMagazineSize,
      magazineSize: COMBAT_RULES.rifleMagazineSize,
      nextFireTick: 0,
      reloadCompleteTick: null,
    },
    spawnPointIndex,
    velocity: { x: 0, z: 0 },
    input: {
      aimPitch: 0,
      aimYaw: 0,
      clientTimeMs: 0,
      moveForward: 0,
      moveRight: 0,
      sequence: -1,
    },
  };
}

function historyFrame(state: Omit<CombatState, "history">): CombatHistoryFrame {
  const survivors: Record<string, CombatHistorySurvivor> = {};
  for (const [playerId, survivor] of Object.entries(state.survivors)) {
    survivors[playerId] = { alive: survivor.alive, position: survivor.position };
  }

  const enemies = Object.fromEntries(Object.entries(state.enemies).map(([entityId, enemy]) => [
    entityId,
    { alive: enemy.alive, position: enemy.position },
  ]));

  return {
    enemies,
    survivors,
    tick: state.tick,
    timeMs: state.timeMs,
  };
}

export interface CreateCombatStateOptions {
  readonly biome: CombatBiome;
  readonly playerIds: readonly string[];
  readonly seed: number | string;
  readonly startedAtMs: number;
}

export function createCombatState(options: CreateCombatStateOptions): CombatState {
  if (options.playerIds.length === 0) {
    throw new RangeError("Combat needs at least one player");
  }
  if (!Number.isSafeInteger(options.startedAtMs) || options.startedAtMs < 0) {
    throw new RangeError("startedAtMs must be a non-negative safe integer");
  }

  const uniquePlayerIds = [...new Set(options.playerIds)];
  if (uniquePlayerIds.length !== options.playerIds.length) {
    throw new RangeError("Combat player ids must be unique");
  }

  const map = createDeterministicGreyboxMap(options.seed);
  const survivors: Record<string, CombatSurvivorState> = {};
  uniquePlayerIds.forEach((playerId, index) => {
    survivors[playerId] = initialSurvivor(playerId, index, map);
  });

  const waveCreation = createWaveDirectorState(createRandomState(options.seed), 1, 0);
  const withoutHistory = {
    biome: options.biome,
    enemies: {},
    enemyRevision: 0,
    enemyTombstones: {},
    map,
    rng: waveCreation.rng,
    startedAtMs: options.startedAtMs,
    survivors,
    tick: 0,
    timeMs: options.startedAtMs,
    wave: waveCreation.wave,
  };

  return { ...withoutHistory, history: [historyFrame(withoutHistory)] };
}

export function createCombatStartedEvent(state: CombatState): CombatEvent {
  return {
    type: "combat.started",
    biome: state.biome,
    canonicalLayoutId: state.map.canonicalLayoutId,
    enemyIds: Object.keys(state.enemies),
    layoutHash: state.map.layoutHash,
    seed: state.rng.seed,
    tickRate: COMBAT_TICK_RATE,
    waveNumber: state.wave.waveNumber,
  };
}

export function createWaveStartedEvent(state: CombatState): CombatEvent {
  return {
    type: "combat.wave_started",
    enemyCount: state.wave.enemiesRemaining,
    spawnSeed: state.wave.spawnSeed,
    tick: state.tick,
    waveKind: state.wave.waveKind,
    waveNumber: state.wave.waveNumber,
    waveRevision: state.wave.revision,
  };
}

function reject(
  state: CombatState,
  code: CombatRuleErrorCode,
  message: string,
): CombatReduction {
  return { accepted: false, state, events: [], error: { code, message } };
}

function activeSurvivor(state: CombatState, playerId: string): CombatSurvivorState | null {
  const survivor = state.survivors[playerId];
  return survivor?.alive === true ? survivor : null;
}

function replaceSurvivor(
  state: CombatState,
  survivor: CombatSurvivorState,
): CombatState {
  return {
    ...state,
    survivors: { ...state.survivors, [survivor.playerId]: survivor },
  };
}

function reduceInput(
  state: CombatState,
  playerId: string,
  command: Extract<CombatCommand, { type: "combat.input" }>,
): CombatReduction {
  const survivor = activeSurvivor(state, playerId);
  if (survivor === null) {
    return reject(state, "COMBAT_PLAYER_INACTIVE", "The authenticated combat player is inactive");
  }

  if (command.sequence <= survivor.input.sequence) {
    return reject(state, "INPUT_SEQUENCE_REPLAY", "Input sequence is stale or duplicated");
  }
  if (
    command.clientTimeMs < survivor.input.clientTimeMs ||
    command.clientTimeMs < state.timeMs - COMBAT_RULES.inputExpiryMs
  ) {
    return reject(state, "INPUT_EXPIRED", "Input timestamp is older than the accepted input window");
  }
  if (command.clientTimeMs > state.timeMs + COMBAT_RULES.inputExpiryMs) {
    return reject(state, "INPUT_EXPIRED", "Input timestamp is implausibly far in the future");
  }

  const movementMagnitude = Math.hypot(command.moveForward, command.moveRight);
  if (
    movementMagnitude > 1.000_001 ||
    command.aimPitch < -COMBAT_RULES.maxAimPitch ||
    command.aimPitch > COMBAT_RULES.maxAimPitch ||
    command.aimYaw < -Math.PI ||
    command.aimYaw > Math.PI
  ) {
    return reject(state, "INVALID_MOVEMENT", "Movement or aim exceeds authoritative limits");
  }

  return {
    accepted: true,
    events: [],
    state: replaceSurvivor(state, {
      ...survivor,
      input: {
        aimPitch: command.aimPitch,
        aimYaw: command.aimYaw,
        clientTimeMs: command.clientTimeMs,
        moveForward: command.moveForward,
        moveRight: command.moveRight,
        sequence: command.sequence,
      },
    }),
  };
}

function interpolateVector(
  left: CombatVector2,
  right: CombatVector2,
  amount: number,
): CombatVector2 {
  return {
    x: left.x + (right.x - left.x) * amount,
    z: left.z + (right.z - left.z) * amount,
  };
}

interface HistoricalSample {
  readonly enemies: Readonly<Record<string, { readonly alive: boolean; readonly position: CombatVector2 }>>;
  readonly survivor: CombatHistorySurvivor | null;
}

function sampleHistory(
  history: readonly CombatHistoryFrame[],
  playerId: string,
  atMs: number,
): HistoricalSample {
  const first = history[0];
  const last = history.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("Combat history must contain at least one frame");
  }

  let left = first;
  let right = last;
  for (let index = 0; index < history.length; index += 1) {
    const frame = history[index];
    if (frame === undefined) {
      continue;
    }
    if (frame.timeMs <= atMs) {
      left = frame;
    }
    if (frame.timeMs >= atMs) {
      right = frame;
      break;
    }
  }

  const duration = right.timeMs - left.timeMs;
  const amount = duration <= 0 ? 0 : clamp((atMs - left.timeMs) / duration, 0, 1);
  const leftSurvivor = left.survivors[playerId];
  const rightSurvivor = right.survivors[playerId];
  const survivor = leftSurvivor === undefined || rightSurvivor === undefined
    ? null
    : {
        alive: leftSurvivor.alive && rightSurvivor.alive,
        position: interpolateVector(leftSurvivor.position, rightSurvivor.position, amount),
      };
  const enemies: Record<string, { readonly alive: boolean; readonly position: CombatVector2 }> = {};
  const enemyIds = new Set([...Object.keys(left.enemies), ...Object.keys(right.enemies)]);
  for (const entityId of enemyIds) {
    const leftEnemy = left.enemies[entityId];
    const rightEnemy = right.enemies[entityId];
    if (rightEnemy === undefined) continue;
    if (leftEnemy === undefined) {
      // Client shot times are integer milliseconds while the 30 Hz host clock
      // advances fractionally. Once the Host has spawned an entity, allow the
      // immediately preceding sub-millisecond sample to see that spawn. Never
      // do the inverse for a right-frame despawn, which would resurrect it.
      enemies[entityId] = rightEnemy;
      continue;
    }
    enemies[entityId] = {
      alive: leftEnemy.alive && rightEnemy.alive,
      position: interpolateVector(leftEnemy.position, rightEnemy.position, amount),
    };
  }

  return {
    enemies,
    survivor,
  };
}

function rayHitDistance(
  origin: CombatVector2,
  aimYaw: number,
  aimPitch: number,
  target: CombatVector2,
): number | null {
  const cosPitch = Math.cos(aimPitch);
  const direction = {
    x: Math.sin(aimYaw) * cosPitch,
    y: Math.sin(aimPitch),
    z: Math.cos(aimYaw) * cosPitch,
  };
  const toTarget = {
    x: target.x - origin.x,
    y: COMBAT_RULES.thrallCoreHeight - COMBAT_RULES.survivorEyeHeight,
    z: target.z - origin.z,
  };
  const projection =
    toTarget.x * direction.x + toTarget.y * direction.y + toTarget.z * direction.z;
  if (projection < 0 || projection > COMBAT_RULES.rifleRange) {
    return null;
  }

  const perpendicularSquared =
    toTarget.x ** 2 + toTarget.y ** 2 + toTarget.z ** 2 - projection ** 2;
  return perpendicularSquared <= COMBAT_RULES.thrallHitRadius ** 2 ? projection : null;
}

function deathCuePosition(position: CombatVector2, entityKind: "survivor" | "thrall"): QuantizedCombatPosition {
  const y = entityKind === "survivor"
    ? COMBAT_RULES.survivorEyeHeight / 2
    : COMBAT_RULES.thrallCoreHeight;
  return [
    Math.round(position.x * DEATH_CUE_CENTIMETERS),
    Math.round(y * DEATH_CUE_CENTIMETERS),
    Math.round(position.z * DEATH_CUE_CENTIMETERS),
  ];
}

function reduceFire(
  state: CombatState,
  playerId: string,
  command: Extract<CombatCommand, { type: "combat.fire" }>,
): CombatReduction {
  const survivor = activeSurvivor(state, playerId);
  if (survivor === null) {
    return reject(state, "COMBAT_PLAYER_INACTIVE", "The authenticated combat player is inactive");
  }
  if (command.shotSequence <= survivor.lastShotSequence) {
    return reject(state, "INPUT_SEQUENCE_REPLAY", "Shot sequence is stale or duplicated");
  }
  if (
    survivor.rifle.ammo <= 0 ||
    survivor.rifle.reloadCompleteTick !== null ||
    state.tick < survivor.rifle.nextFireTick
  ) {
    return reject(state, "WEAPON_UNAVAILABLE", "The rifle cannot fire at this tick");
  }

  const earliestHistoryMs = Math.max(
    state.startedAtMs,
    state.timeMs - COMBAT_REWIND_WINDOW_MS,
    state.history[0]?.timeMs ?? state.timeMs,
  );
  const evaluatedAtMs = clamp(command.clientShotTimeMs, earliestHistoryMs, state.timeMs);
  const rewindClamped = evaluatedAtMs !== command.clientShotTimeMs;
  const sample = sampleHistory(state.history, playerId, evaluatedAtMs);
  let targetEntityId: string | null = null;
  let targetDistance = Number.POSITIVE_INFINITY;
  if (sample.survivor?.alive === true) {
    for (const [entityId, historicalEnemy] of Object.entries(sample.enemies)) {
      if (!historicalEnemy.alive || state.enemies[entityId]?.alive !== true) continue;
      const distance = rayHitDistance(
        sample.survivor.position,
        survivor.input.aimYaw,
        survivor.input.aimPitch,
        historicalEnemy.position,
      );
      if (
        distance !== null
        && (distance < targetDistance || (distance === targetDistance && entityId < (targetEntityId ?? "\uffff")))
      ) {
        targetDistance = distance;
        targetEntityId = entityId;
      }
    }
  }
  const hit = targetEntityId !== null;
  const rifle = {
    ...survivor.rifle,
    ammo: survivor.rifle.ammo - 1,
    nextFireTick: state.tick + COMBAT_RULES.rifleFireIntervalTicks,
  };
  let nextSurvivor: CombatSurvivorState = {
    ...survivor,
    lastShotSequence: command.shotSequence,
    rifle,
  };
  const events: CombatEvent[] = [
    {
      type: "combat.shot_fired",
      ammoRemaining: rifle.ammo,
      evaluatedAtMs,
      hit,
      playerId,
      rewindClamped,
      shotSequence: command.shotSequence,
    },
  ];
  let nextEnemies = state.enemies;
  let enemyRevision = state.enemyRevision;
  let nextRng = state.rng;

  if (targetEntityId !== null) {
    const target = state.enemies[targetEntityId];
    if (target === undefined) throw new Error("Historical target disappeared from authoritative state");
    const hp = Math.max(0, target.hp - COMBAT_RULES.rifleDamage);
    let nextTarget: ThrallState = {
      ...target,
      animationRevision: target.animationRevision + 1,
      animationState: hp === 0 ? "dead" : "hit",
      animationUntilTick: hp === 0 ? null : state.tick + 6,
      hp,
      velocity: hp === 0 ? { x: 0, z: 0 } : target.velocity,
    };
    events.push({
      type: "combat.entity_damaged",
      amount: COMBAT_RULES.rifleDamage,
      remainingHp: hp,
      sourceEntityId: playerId,
      targetEntityId,
    });

    if (hp === 0) {
      const cueSeed = nextUint32(state.rng);
      nextRng = cueSeed.state;
      nextTarget = {
        ...nextTarget,
        alive: false,
        despawnAtTick: state.tick + WAVE_DIRECTOR_RULES.enemyDespawnTicks,
      };
      nextSurvivor = { ...nextSurvivor, kills: nextSurvivor.kills + 1 };
      events.push(
        {
          type: "combat.entity_killed",
          entityId: targetEntityId,
          entityKind: "thrall",
          killerPlayerId: playerId,
          tick: state.tick,
        },
        {
          type: "combat.death_cue",
          biome: state.biome,
          entityId: targetEntityId,
          pos: deathCuePosition(target.position, "thrall"),
          seed: cueSeed.value,
        },
      );
    }
    nextEnemies = { ...state.enemies, [targetEntityId]: nextTarget };
    enemyRevision += 1;
  }

  return {
    accepted: true,
    events,
    state: {
      ...state,
      enemies: nextEnemies,
      enemyRevision,
      rng: nextRng,
      survivors: { ...state.survivors, [playerId]: nextSurvivor },
    },
  };
}

function reduceReload(state: CombatState, playerId: string): CombatReduction {
  const survivor = activeSurvivor(state, playerId);
  if (survivor === null) {
    return reject(state, "COMBAT_PLAYER_INACTIVE", "The authenticated combat player is inactive");
  }
  if (
    survivor.rifle.reloadCompleteTick !== null ||
    survivor.rifle.ammo === survivor.rifle.magazineSize
  ) {
    return reject(state, "WEAPON_UNAVAILABLE", "The rifle cannot reload now");
  }

  return {
    accepted: true,
    events: [],
    state: replaceSurvivor(state, {
      ...survivor,
      rifle: {
        ...survivor.rifle,
        reloadCompleteTick: state.tick + COMBAT_RULES.rifleReloadTicks,
      },
    }),
  };
}

export function reduceCombatCommand(
  state: CombatState,
  playerId: string,
  command: CombatCommand,
): CombatReduction {
  if (!isCombatCommandShape(command)) {
    return reject(state, "INVALID_COMBAT_COMMAND", "Combat command has unknown or forged fields");
  }

  switch (command.type) {
    case "combat.input":
      return reduceInput(state, playerId, command);
    case "combat.fire":
      return reduceFire(state, playerId, command);
    case "combat.reload":
      return reduceReload(state, playerId);
    default: {
      const exhaustiveCommand: never = command;
      return exhaustiveCommand;
    }
  }
}

function moveToward(current: number, target: number, maximumDelta: number): number {
  if (Math.abs(target - current) <= maximumDelta) {
    return target;
  }
  return current + Math.sign(target - current) * maximumDelta;
}

function integrateSurvivorMovement(
  survivor: CombatSurvivorState,
  map: CombatMapLayout,
): CombatSurvivorState {
  const sinYaw = Math.sin(survivor.input.aimYaw);
  const cosYaw = Math.cos(survivor.input.aimYaw);
  const desiredVelocity = {
    x: (
      sinYaw * survivor.input.moveForward + cosYaw * survivor.input.moveRight
    ) * COMBAT_RULES.survivorMaxSpeed,
    z: (
      cosYaw * survivor.input.moveForward - sinYaw * survivor.input.moveRight
    ) * COMBAT_RULES.survivorMaxSpeed,
  };
  const maximumVelocityDelta = COMBAT_RULES.survivorAcceleration / COMBAT_TICK_RATE;
  const velocity = quantizeVector({
    x: moveToward(survivor.velocity.x, desiredVelocity.x, maximumVelocityDelta),
    z: moveToward(survivor.velocity.z, desiredVelocity.z, maximumVelocityDelta),
  });
  const speed = Math.hypot(velocity.x, velocity.z);
  const boundedVelocity = speed <= COMBAT_RULES.survivorMaxSpeed
    ? velocity
    : quantizeVector({
        x: (velocity.x / speed) * COMBAT_RULES.survivorMaxSpeed,
        z: (velocity.z / speed) * COMBAT_RULES.survivorMaxSpeed,
      });
  const position = quantizeVector(moveWithinCombatMap(
    map,
    survivor.position,
    {
      x: boundedVelocity.x / COMBAT_TICK_RATE,
      z: boundedVelocity.z / COMBAT_TICK_RATE,
    },
    COMBAT_RULES.survivorRadius,
  ));

  return { ...survivor, position, velocity: boundedVelocity };
}

/**
 * Presentation-only movement prediction using the exact Host integrator.
 * Damage, HP, ammo, respawn and hit confirmation remain authoritative.
 */
export function predictSurvivorMovementTick(
  survivor: CombatSurvivorState,
  input: SurvivorInputState,
  map: CombatMapLayout,
): CombatSurvivorState {
  if (!survivor.alive) return survivor;
  return integrateSurvivorMovement({ ...survivor, input }, map);
}

function stepSurvivor(
  survivor: CombatSurvivorState,
  tick: number,
  map: CombatMapLayout,
): CombatSurvivorState {
  if (!survivor.alive) {
    if (survivor.respawnAtTick !== null && tick >= survivor.respawnAtTick) {
      return {
        ...survivor,
        alive: true,
        hp: survivor.maxHp,
        position: map.playerSpawnPoints[survivor.spawnPointIndex] ?? map.playerSpawnZone.center,
        respawnAtTick: null,
        velocity: { x: 0, z: 0 },
      };
    }
    return survivor;
  }

  const moved = integrateSurvivorMovement(survivor, map);
  const reloadFinished =
    survivor.rifle.reloadCompleteTick !== null && tick >= survivor.rifle.reloadCompleteTick;

  return {
    ...moved,
    rifle: reloadFinished
      ? {
          ...survivor.rifle,
          ammo: survivor.rifle.magazineSize,
          reloadCompleteTick: null,
      }
      : survivor.rifle,
  };
}

function nearestSurvivor(
  survivors: Readonly<Record<string, CombatSurvivorState>>,
  position: CombatVector2,
): CombatSurvivorState | null {
  let nearest: CombatSurvivorState | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const survivor of Object.values(survivors)) {
    if (!survivor.alive) {
      continue;
    }
    const distance = Math.hypot(
      survivor.position.x - position.x,
      survivor.position.z - position.z,
    );
    if (
      distance < nearestDistance
      || (distance === nearestDistance && survivor.playerId < (nearest?.playerId ?? "\uffff"))
    ) {
      nearest = survivor;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function withEnemyAnimation(
  enemy: ThrallState,
  animationState: ThrallState["animationState"],
  animationUntilTick: number | null,
): ThrallState {
  if (
    enemy.animationState === animationState
    && enemy.animationUntilTick === animationUntilTick
  ) return enemy;
  return {
    ...enemy,
    animationRevision: enemy.animationRevision + 1,
    animationState,
    animationUntilTick,
  };
}

function stepThrall(
  state: CombatState,
  enemy: ThrallState,
  survivors: Readonly<Record<string, CombatSurvivorState>>,
  tick: number,
): {
  readonly events: readonly CombatEvent[];
  readonly rng: CombatState["rng"];
  readonly survivors: Readonly<Record<string, CombatSurvivorState>>;
  readonly thrall: ThrallState;
} {
  if (!enemy.alive) return { events: [], rng: state.rng, survivors, thrall: enemy };

  const target = nearestSurvivor(survivors, enemy.position);
  if (target === null) {
    return {
      events: [],
      rng: state.rng,
      survivors,
      thrall: withEnemyAnimation({ ...enemy, targetPlayerId: null, velocity: { x: 0, z: 0 } }, "idle", null),
    };
  }
  const offset = {
    x: target.position.x - enemy.position.x,
    z: target.position.z - enemy.position.z,
  };
  const distance = Math.hypot(offset.x, offset.z);
  if (distance > COMBAT_RULES.thrallAttackRange) {
    const speedMultiplier = 1 + Math.min(0.5, (enemy.waveNumber - 1) * 0.05);
    const stepDistance = Math.min(
      distance - COMBAT_RULES.thrallAttackRange,
      COMBAT_RULES.thrallSpeed * speedMultiplier / COMBAT_TICK_RATE,
    );
    const position = quantizeVector(moveWithinCombatMap(
      state.map,
      enemy.position,
      { x: (offset.x / distance) * stepDistance, z: (offset.z / distance) * stepDistance },
      COMBAT_RULES.thrallRadius,
    ));
    const moved = position.x !== enemy.position.x || position.z !== enemy.position.z;
    const movingEnemy: ThrallState = {
      ...enemy,
      position,
      targetPlayerId: target.playerId,
      velocity: {
        x: quantize((position.x - enemy.position.x) * COMBAT_TICK_RATE),
        z: quantize((position.z - enemy.position.z) * COMBAT_TICK_RATE),
      },
    };
    const holdingAnimation = enemy.animationUntilTick !== null && tick < enemy.animationUntilTick;
    return {
      events: [],
      rng: state.rng,
      survivors,
      thrall: holdingAnimation
        ? movingEnemy
        : withEnemyAnimation(movingEnemy, moved ? "moving" : "idle", null),
    };
  }
  if (tick < enemy.attackReadyTick) {
    const waiting = { ...enemy, targetPlayerId: target.playerId, velocity: { x: 0, z: 0 } };
    return {
      events: [],
      rng: state.rng,
      survivors,
      thrall: enemy.animationUntilTick !== null && tick < enemy.animationUntilTick
        ? waiting
        : withEnemyAnimation(waiting, "idle", null),
    };
  }

  const hp = Math.max(0, target.hp - COMBAT_RULES.thrallAttackDamage);
  const killed = hp === 0;
  const nextTarget: CombatSurvivorState = {
    ...target,
    alive: !killed,
    hp,
    respawnAtTick: killed ? tick + COMBAT_RULES.survivorRespawnTicks : null,
    velocity: killed ? { x: 0, z: 0 } : target.velocity,
  };
  const nextSurvivors = { ...survivors, [target.playerId]: nextTarget };
  const events: CombatEvent[] = [{
    type: "combat.entity_damaged",
    amount: COMBAT_RULES.thrallAttackDamage,
    remainingHp: hp,
    sourceEntityId: enemy.entityId,
    targetEntityId: target.playerId,
  }];
  let nextRng = state.rng;

  if (killed) {
    const cueSeed = nextUint32(state.rng);
    nextRng = cueSeed.state;
    events.push(
      {
        type: "combat.entity_killed",
        entityId: target.playerId,
        entityKind: "survivor",
        killerPlayerId: null,
        tick,
      },
      {
        type: "combat.death_cue",
        biome: state.biome,
        entityId: target.playerId,
        pos: deathCuePosition(target.position, "survivor"),
        seed: cueSeed.value,
      },
    );
  }

  return {
    events,
    rng: nextRng,
    survivors: nextSurvivors,
    thrall: withEnemyAnimation({
      ...enemy,
      attackReadyTick: tick + COMBAT_RULES.thrallAttackIntervalTicks,
      targetPlayerId: target.playerId,
      velocity: { x: 0, z: 0 },
    }, "attacking", tick + 10),
  };
}

function survivorRespawnEvents(
  before: Readonly<Record<string, CombatSurvivorState>>,
  after: Readonly<Record<string, CombatSurvivorState>>,
  tick: number,
): readonly CombatEvent[] {
  const events: CombatEvent[] = [];
  for (const [playerId, survivor] of Object.entries(after)) {
    if (before[playerId]?.alive === false && survivor.alive) {
      events.push({
        type: "combat.entity_respawned",
        entityId: playerId,
        entityKind: "survivor",
        position: survivor.position,
        tick,
      });
    }
  }
  return events;
}

function reviseWave(
  wave: WaveDirectorState,
  patch: Partial<WaveDirectorState>,
): WaveDirectorState {
  return { ...wave, ...patch, revision: wave.revision + 1 };
}

export function advanceCombatTick(state: CombatState): CombatSimulationResult {
  const tick = state.tick + 1;
  const timeMs = state.startedAtMs + tick * COMBAT_TICK_MS;
  const survivors: Record<string, CombatSurvivorState> = {};
  for (const [playerId, survivor] of Object.entries(state.survivors)) {
    survivors[playerId] = stepSurvivor(survivor, tick, state.map);
  }
  const respawnEvents = survivorRespawnEvents(state.survivors, survivors, tick);
  const events: CombatEvent[] = [...respawnEvents];
  let enemies = state.enemies;
  let tombstones = state.enemyTombstones;
  let enemyRevision = state.enemyRevision;
  let wave = state.wave;
  let nextRng = state.rng;

  if (wave.phase === "break" && wave.breakEndsAtTick !== null && tick >= wave.breakEndsAtTick) {
    const nextWave = createWaveDirectorState(nextRng, wave.waveNumber + 1, tick, wave.revision);
    nextRng = nextWave.rng;
    wave = nextWave.wave;
    events.push({
      type: "combat.wave_started",
      enemyCount: wave.enemiesRemaining,
      spawnSeed: wave.spawnSeed,
      tick,
      waveKind: wave.waveKind,
      waveNumber: wave.waveNumber,
      waveRevision: wave.revision,
    });
  }

  let spawnCursor = wave.spawnCursor;
  while (wave.phase === "spawning") {
    const scheduled = wave.spawnSchedule[spawnCursor];
    if (scheduled === undefined || scheduled.spawnAtTick > tick) break;
    const enemy = createScheduledThrall(state.map, scheduled, wave, tick, COMBAT_RULES.thrallMaxHp);
    const spawned = spawnEnemyIntoCollection(enemies, tombstones, enemy);
    if (!spawned.accepted) {
      throw new Error(`Host rejected scheduled enemy spawn: ${spawned.reason}`);
    }
    enemies = spawned.enemies;
    spawnCursor += 1;
    enemyRevision += 1;
    events.push({
      type: "combat.enemy_spawned",
      entityId: enemy.entityId,
      position: enemy.position,
      spawnZoneId: enemy.spawnZoneId,
      tick,
      waveNumber: enemy.waveNumber,
    });
  }
  if (spawnCursor !== wave.spawnCursor) wave = reviseWave(wave, { spawnCursor });
  if (wave.phase === "spawning" && wave.spawnCursor >= wave.spawnSchedule.length) {
    wave = reviseWave(wave, { phase: "combat" });
  }

  let steppedSurvivors: Readonly<Record<string, CombatSurvivorState>> = survivors;
  const steppedEnemies: Record<string, ThrallState> = {};
  let enemyStateChanged = enemies !== state.enemies;
  for (const entityId of Object.keys(enemies).sort()) {
    const enemy = enemies[entityId];
    if (enemy === undefined) continue;
    if (!enemy.alive && enemy.despawnAtTick !== null && tick >= enemy.despawnAtTick) {
      const despawned = despawnEnemyFromCollection(enemies, tombstones, entityId, tick);
      tombstones = despawned.tombstones;
      enemyStateChanged = true;
      events.push({ type: "combat.enemy_despawned", entityId, tick });
      continue;
    }
    const stepped = stepThrall(
      { ...state, enemies, rng: nextRng, survivors: steppedSurvivors, tick, timeMs, wave },
      enemy,
      steppedSurvivors,
      tick,
    );
    steppedSurvivors = stepped.survivors;
    nextRng = stepped.rng;
    steppedEnemies[entityId] = stepped.thrall;
    if (stepped.thrall !== enemy) enemyStateChanged = true;
    events.push(...stepped.events);
  }
  enemies = steppedEnemies;
  if (enemyStateChanged) enemyRevision += 1;

  const enemiesRemaining = wave.spawnSchedule.length - wave.spawnCursor + Object.keys(enemies).length;
  if (enemiesRemaining !== wave.enemiesRemaining) {
    wave = reviseWave(wave, { enemiesRemaining });
  }
  if (wave.phase !== "break" && wave.spawnCursor >= wave.spawnSchedule.length && enemiesRemaining === 0) {
    const breakEndsAtTick = tick + WAVE_DIRECTOR_RULES.breakTicks;
    wave = reviseWave(wave, { breakEndsAtTick, phase: "break" });
    events.push({
      type: "combat.wave_completed",
      breakEndsAtTick,
      tick,
      waveNumber: wave.waveNumber,
      waveRevision: wave.revision,
    });
  }

  const withoutHistory = {
    ...state,
    enemies,
    enemyRevision,
    enemyTombstones: tombstones,
    rng: nextRng,
    survivors: steppedSurvivors,
    tick,
    timeMs,
    wave,
  };
  const frame = historyFrame(withoutHistory);
  const cutoff = timeMs - COMBAT_REWIND_WINDOW_MS;
  const retained = state.history.filter((candidate) => candidate.timeMs >= cutoff);

  return {
    events,
    state: { ...withoutHistory, history: [...retained, frame] },
  };
}

export function advanceCombatTicks(state: CombatState, tickCount = 1): CombatSimulationResult {
  if (!Number.isSafeInteger(tickCount) || tickCount < 1 || tickCount > COMBAT_TICK_RATE) {
    throw new RangeError("tickCount must be an integer from 1 to 30");
  }

  let nextState = state;
  const events: CombatEvent[] = [];
  for (let tick = 0; tick < tickCount; tick += 1) {
    const step = advanceCombatTick(nextState);
    nextState = step.state;
    events.push(...step.events);
  }
  return { state: nextState, events };
}

/**
 * Validates restored or externally decoded state. Runtime movement itself is
 * input-driven and never accepts a client position, so this is the server seam
 * for rejecting a corrupted checkpoint or teleporting transition.
 */
export function isValidMovementTransition(
  previous: CombatSurvivorState,
  next: CombatSurvivorState,
  elapsedMs: number,
): boolean {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return false;
  }
  const seconds = elapsedMs / 1_000;
  const speed = Math.hypot(
    next.position.x - previous.position.x,
    next.position.z - previous.position.z,
  ) / seconds;
  const acceleration = Math.hypot(
    next.velocity.x - previous.velocity.x,
    next.velocity.z - previous.velocity.z,
  ) / seconds;
  return (
    speed <= COMBAT_RULES.survivorMaxSpeed + 0.01 &&
    acceleration <= COMBAT_RULES.survivorAcceleration + 0.05
  );
}
