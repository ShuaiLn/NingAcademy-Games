import type { RandomState } from "./types.js";

const NON_ZERO_FALLBACK_SEED = 0x6d2b79f5;

function hashStringSeed(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function normalizeSeed(seed: number | string): number {
  const normalized =
    typeof seed === "string"
      ? hashStringSeed(seed)
      : Number.isFinite(seed)
        ? Math.trunc(seed) >>> 0
        : NON_ZERO_FALLBACK_SEED;

  return normalized === 0 ? NON_ZERO_FALLBACK_SEED : normalized;
}

export function createRandomState(seed: number | string): RandomState {
  const normalized = normalizeSeed(seed);

  return {
    seed: normalized,
    state: normalized,
    draws: 0,
  };
}

export interface RandomDraw<T> {
  readonly state: RandomState;
  readonly value: T;
}

export function nextUint32(random: RandomState): RandomDraw<number> {
  let value = random.state || NON_ZERO_FALLBACK_SEED;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  value >>>= 0;

  return {
    state: {
      seed: random.seed,
      state: value,
      draws: random.draws + 1,
    },
    value,
  };
}

export function nextFloat(random: RandomState): RandomDraw<number> {
  const draw = nextUint32(random);

  return {
    state: draw.state,
    value: draw.value / 0x1_0000_0000,
  };
}

export function randomInt(random: RandomState, exclusiveMax: number): RandomDraw<number> {
  if (!Number.isSafeInteger(exclusiveMax) || exclusiveMax <= 0) {
    throw new RangeError("exclusiveMax must be a positive safe integer");
  }

  const draw = nextFloat(random);

  return {
    state: draw.state,
    value: Math.floor(draw.value * exclusiveMax),
  };
}

export function shuffle<T>(random: RandomState, values: readonly T[]): RandomDraw<readonly T[]> {
  const shuffled = [...values];
  let nextState = random;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const draw = randomInt(nextState, index + 1);
    nextState = draw.state;
    const swap = shuffled[index];
    shuffled[index] = shuffled[draw.value] as T;
    shuffled[draw.value] = swap as T;
  }

  return {
    state: nextState,
    value: shuffled,
  };
}
