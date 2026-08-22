import {
  isCompatibleCombatMapLayout,
  predictSurvivorMovementTick,
  type CombatState,
  type CombatSurvivorState,
  type GameState,
  type SurvivorInputState,
  type ThrallState,
} from "@ningacademy/game-core";

export const REMOTE_INTERPOLATION_DELAY_MS = 100;
const MAX_PENDING_INPUTS = 64;

interface TimedSnapshot {
  readonly receivedAtMs: number;
  readonly state: Readonly<GameState>;
}

export interface CombatPresentationFrame {
  readonly combat: Readonly<CombatState>;
  readonly enemies: Readonly<Record<string, Readonly<ThrallState>>>;
  readonly localSurvivor: Readonly<CombatSurvivorState> | null;
  readonly revision: number;
  readonly survivors: Readonly<Record<string, Readonly<CombatSurvivorState>>>;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(left: number, right: number, amount: number): number {
  return left + (right - left) * amount;
}

function interpolateSurvivor(
  previous: Readonly<CombatSurvivorState> | undefined,
  current: Readonly<CombatSurvivorState>,
  amount: number,
): Readonly<CombatSurvivorState> {
  if (previous === undefined || previous.alive !== current.alive) return current;
  return {
    ...current,
    position: {
      x: lerp(previous.position.x, current.position.x, amount),
      z: lerp(previous.position.z, current.position.z, amount),
    },
    velocity: {
      x: lerp(previous.velocity.x, current.velocity.x, amount),
      z: lerp(previous.velocity.z, current.velocity.z, amount),
    },
  };
}

function interpolateEnemy(
  previous: Readonly<ThrallState> | undefined,
  current: Readonly<ThrallState>,
  amount: number,
): Readonly<ThrallState> {
  if (
    previous === undefined
    || previous.alive !== current.alive
    || previous.entityId !== current.entityId
  ) return current;
  return {
    ...current,
    position: {
      x: lerp(previous.position.x, current.position.x, amount),
      z: lerp(previous.position.z, current.position.z, amount),
    },
  };
}

/**
 * Client presentation timeline. Remote entities interpolate behind the newest
 * Host snapshot while the local survivor predicts only movement. Every newer
 * Host snapshot discards acknowledged inputs and replays the remaining ones;
 * HP, damage, ammo and hit confirmation always come from Host state.
 */
export class MultiplayerPresentationTimeline {
  readonly #localPlayerId: string;
  #current: TimedSnapshot | null = null;
  #enemyRevision = -1;
  #enemyTombstones = new Set<string>();
  #pendingInputs: SurvivorInputState[] = [];
  #predictedLocal: CombatSurvivorState | null = null;
  #previous: TimedSnapshot | null = null;
  #roomId: string | null = null;
  #waveRevision = -1;

  constructor(localPlayerId: string) {
    const normalized = localPlayerId.trim();
    if (normalized.length === 0 || normalized.length > 128) {
      throw new RangeError("localPlayerId must contain between 1 and 128 characters");
    }
    this.#localPlayerId = normalized;
  }

  get pendingInputCount(): number {
    return this.#pendingInputs.length;
  }

  pushSnapshot(state: Readonly<GameState>, receivedAtMs: number): boolean {
    if (!Number.isFinite(receivedAtMs) || state.combat === null || state.status !== "running") {
      return false;
    }
    if (!isCompatibleCombatMapLayout(state.combat.map)) return false;
    if (this.#roomId !== null && state.roomId !== this.#roomId) return false;
    if (this.#current !== null && state.revision <= this.#current.state.revision) return false;
    if (state.combat.enemyRevision < this.#enemyRevision || state.combat.wave.revision < this.#waveRevision) {
      return false;
    }
    for (const entityId of Object.keys(state.combat.enemies)) {
      if (
        this.#enemyTombstones.has(entityId)
        || state.combat.enemyTombstones[entityId] !== undefined
      ) return false;
    }

    const previousEnemies = this.#current?.state.combat?.enemies ?? {};
    for (const entityId of Object.keys(previousEnemies)) {
      if (state.combat.enemies[entityId] === undefined) this.#enemyTombstones.add(entityId);
    }
    for (const entityId of Object.keys(state.combat.enemyTombstones)) {
      this.#enemyTombstones.add(entityId);
    }
    this.#enemyRevision = state.combat.enemyRevision;
    this.#waveRevision = state.combat.wave.revision;

    this.#roomId = state.roomId;
    this.#previous = this.#current;
    this.#current = { receivedAtMs, state };
    const authoritative = state.combat.survivors[this.#localPlayerId];
    if (authoritative === undefined) {
      this.#pendingInputs = [];
      this.#predictedLocal = null;
      return true;
    }

    this.#pendingInputs = this.#pendingInputs.filter(
      (input) => input.sequence > authoritative.input.sequence,
    );
    const map = state.combat.map;
    this.#predictedLocal = this.#pendingInputs.reduce(
      (survivor, input) => predictSurvivorMovementTick(survivor, input, map),
      authoritative,
    );
    return true;
  }

  queueLocalInput(input: SurvivorInputState): boolean {
    const latestSequence = this.#pendingInputs.at(-1)?.sequence
      ?? this.#current?.state.combat?.survivors[this.#localPlayerId]?.input.sequence
      ?? -1;
    if (input.sequence <= latestSequence || this.#predictedLocal === null) return false;
    const map = this.#current?.state.combat?.map;
    if (map === undefined) return false;
    this.#pendingInputs.push(input);
    if (this.#pendingInputs.length > MAX_PENDING_INPUTS) {
      this.#pendingInputs.splice(0, this.#pendingInputs.length - MAX_PENDING_INPUTS);
    }
    this.#predictedLocal = predictSurvivorMovementTick(this.#predictedLocal, input, map);
    return true;
  }

  sample(nowMs: number): CombatPresentationFrame | null {
    const currentState = this.#current?.state;
    const combat = currentState?.combat;
    if (this.#current === null || currentState === undefined || combat == null) return null;

    const previousCombat = this.#previous?.state.combat ?? null;
    const intervalMs = this.#current.receivedAtMs - (this.#previous?.receivedAtMs ?? this.#current.receivedAtMs);
    const targetMs = nowMs - REMOTE_INTERPOLATION_DELAY_MS;
    const amount = previousCombat === null || intervalMs <= 0
      ? 1
      : clamp01((targetMs - (this.#previous?.receivedAtMs ?? targetMs)) / intervalMs);
    const survivors: Record<string, Readonly<CombatSurvivorState>> = {};
    for (const [playerId, survivor] of Object.entries(combat.survivors)) {
      survivors[playerId] = playerId === this.#localPlayerId && this.#predictedLocal !== null
        ? this.#predictedLocal
        : interpolateSurvivor(previousCombat?.survivors[playerId], survivor, amount);
    }
    const enemies: Record<string, Readonly<ThrallState>> = {};
    for (const [entityId, enemy] of Object.entries(combat.enemies)) {
      if (this.#enemyTombstones.has(entityId)) continue;
      enemies[entityId] = interpolateEnemy(previousCombat?.enemies[entityId], enemy, amount);
    }

    return {
      combat,
      enemies,
      localSurvivor: survivors[this.#localPlayerId] ?? null,
      revision: currentState.revision,
      survivors,
    };
  }
}
