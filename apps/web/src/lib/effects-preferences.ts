import type { FlashMode } from "./flash-governor";

export type ShardMode = "off" | "reduced" | "normal";

export interface EffectsPreferences {
  readonly flashMode: FlashMode;
  readonly hitStop: boolean;
  readonly screenShakePercent: number;
  readonly screecherDistortion: boolean;
  readonly shardMode: ShardMode;
  readonly slowMotion: boolean;
}

export interface TeacherEffectsCeiling {
  readonly allowHitStop: boolean;
  readonly allowScreecherDistortion: boolean;
  readonly allowSlowMotion: boolean;
  readonly maxFlashMode: FlashMode;
  readonly maxScreenShakePercent: number;
  readonly maxShardMode: ShardMode;
}

export const DEFAULT_EFFECTS_PREFERENCES: EffectsPreferences = {
  flashMode: "normal",
  hitStop: true,
  screenShakePercent: 100,
  screecherDistortion: true,
  shardMode: "normal",
  slowMotion: true,
};

export const DEFAULT_TEACHER_EFFECTS_CEILING: TeacherEffectsCeiling = {
  allowHitStop: true,
  allowScreecherDistortion: true,
  allowSlowMotion: true,
  maxFlashMode: "normal",
  maxScreenShakePercent: 100,
  maxShardMode: "normal",
};

const modeWeight = { off: 0, reduced: 1, normal: 2 } as const;

const clampPercent = (value: number): number =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));

const lowerMode = <Mode extends FlashMode | ShardMode>(
  requested: Mode,
  ceiling: Mode,
): Mode => (modeWeight[requested] <= modeWeight[ceiling] ? requested : ceiling);

export function resolveEffectsPreferences(
  requested: EffectsPreferences,
  ceiling: TeacherEffectsCeiling = DEFAULT_TEACHER_EFFECTS_CEILING,
  prefersReducedMotion = false,
): EffectsPreferences {
  if (prefersReducedMotion) {
    return {
      flashMode: "off",
      hitStop: false,
      screenShakePercent: 0,
      screecherDistortion: false,
      shardMode: "reduced",
      slowMotion: false,
    };
  }

  return {
    flashMode: lowerMode(requested.flashMode, ceiling.maxFlashMode),
    hitStop: requested.hitStop && ceiling.allowHitStop,
    screenShakePercent: Math.min(
      clampPercent(requested.screenShakePercent),
      clampPercent(ceiling.maxScreenShakePercent),
    ),
    screecherDistortion:
      requested.screecherDistortion && ceiling.allowScreecherDistortion,
    shardMode: lowerMode(requested.shardMode, ceiling.maxShardMode),
    slowMotion: requested.slowMotion && ceiling.allowSlowMotion,
  };
}

const isMode = (value: unknown): value is FlashMode | ShardMode =>
  value === "off" || value === "reduced" || value === "normal";

export function parseStoredEffectsPreferences(value: string | null): EffectsPreferences {
  if (value === null) {
    return DEFAULT_EFFECTS_PREFERENCES;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_EFFECTS_PREFERENCES;
    }

    const record = parsed as Record<string, unknown>;
    if (
      !isMode(record.flashMode) ||
      typeof record.hitStop !== "boolean" ||
      typeof record.screenShakePercent !== "number" ||
      typeof record.screecherDistortion !== "boolean" ||
      !isMode(record.shardMode) ||
      typeof record.slowMotion !== "boolean"
    ) {
      return DEFAULT_EFFECTS_PREFERENCES;
    }

    return {
      flashMode: record.flashMode,
      hitStop: record.hitStop,
      screenShakePercent: clampPercent(record.screenShakePercent),
      screecherDistortion: record.screecherDistortion,
      shardMode: record.shardMode,
      slowMotion: record.slowMotion,
    };
  } catch {
    return DEFAULT_EFFECTS_PREFERENCES;
  }
}
