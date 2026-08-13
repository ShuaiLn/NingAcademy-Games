import type { RandomState } from "./types.js";

export const COMBAT_TICK_RATE = 30 as const;
export const COMBAT_TICK_MS = 1_000 / COMBAT_TICK_RATE;
export const COMBAT_REWIND_WINDOW_MS = 250 as const;

export type CombatBiome = "house" | "grassland" | "desert" | "hell";
export type CombatEntityKind = "survivor" | "thrall";

export interface CombatVector2 {
  readonly x: number;
  readonly z: number;
}

export interface SurvivorInputState {
  readonly aimPitch: number;
  readonly aimYaw: number;
  readonly clientTimeMs: number;
  readonly moveForward: number;
  readonly moveRight: number;
  readonly sequence: number;
}

export interface RifleState {
  readonly ammo: number;
  readonly magazineSize: number;
  readonly nextFireTick: number;
  readonly reloadCompleteTick: number | null;
}

export interface CombatSurvivorState {
  readonly alive: boolean;
  readonly hp: number;
  readonly kills: number;
  readonly lastShotSequence: number;
  readonly maxHp: number;
  readonly playerId: string;
  readonly position: CombatVector2;
  readonly respawnAtTick: number | null;
  readonly rifle: RifleState;
  readonly velocity: CombatVector2;
  readonly input: SurvivorInputState;
}

export interface ThrallState {
  readonly alive: boolean;
  readonly attackReadyTick: number;
  readonly generation: number;
  readonly hp: number;
  readonly id: string;
  readonly maxHp: number;
  readonly position: CombatVector2;
  readonly respawnAtTick: number | null;
}

export interface CombatHistorySurvivor {
  readonly alive: boolean;
  readonly position: CombatVector2;
}

export interface CombatHistoryThrall {
  readonly alive: boolean;
  readonly generation: number;
  readonly position: CombatVector2;
}

export interface CombatHistoryFrame {
  readonly survivors: Readonly<Record<string, CombatHistorySurvivor>>;
  readonly thrall: CombatHistoryThrall;
  readonly tick: number;
  readonly timeMs: number;
}

export interface CombatState {
  readonly biome: CombatBiome;
  readonly history: readonly CombatHistoryFrame[];
  readonly rng: RandomState;
  readonly startedAtMs: number;
  readonly survivors: Readonly<Record<string, CombatSurvivorState>>;
  readonly thrall: ThrallState;
  readonly tick: number;
  readonly timeMs: number;
}

export type CombatCommand =
  | {
      readonly type: "combat.input";
      readonly sequence: number;
      readonly clientTimeMs: number;
      readonly moveForward: number;
      readonly moveRight: number;
      readonly aimYaw: number;
      readonly aimPitch: number;
    }
  | {
      readonly type: "combat.fire";
      readonly shotSequence: number;
      readonly clientShotTimeMs: number;
    }
  | { readonly type: "combat.reload" };

export type QuantizedCombatPosition = readonly [xCentimeters: number, yCentimeters: number, zCentimeters: number];

export type CombatEvent =
  | {
      readonly type: "combat.started";
      readonly biome: CombatBiome;
      readonly seed: number;
      readonly thrallId: string;
      readonly thrallPosition: CombatVector2;
      readonly tickRate: typeof COMBAT_TICK_RATE;
    }
  | {
      readonly type: "combat.shot_fired";
      readonly ammoRemaining: number;
      readonly evaluatedAtMs: number;
      readonly hit: boolean;
      readonly playerId: string;
      readonly rewindClamped: boolean;
      readonly shotSequence: number;
    }
  | {
      readonly type: "combat.entity_damaged";
      readonly amount: number;
      readonly remainingHp: number;
      readonly sourceEntityId: string;
      readonly targetEntityId: string;
    }
  | {
      readonly type: "combat.entity_killed";
      readonly entityId: string;
      readonly entityKind: CombatEntityKind;
      readonly killerPlayerId: string | null;
      readonly tick: number;
    }
  | {
      readonly type: "combat.death_cue";
      readonly biome: CombatBiome;
      readonly entityId: string;
      readonly pos: QuantizedCombatPosition;
      readonly seed: number;
    }
  | {
      readonly type: "combat.entity_respawned";
      readonly entityId: string;
      readonly entityKind: CombatEntityKind;
      readonly position: CombatVector2;
      readonly tick: number;
    };

export type CombatRuleErrorCode =
  | "COMBAT_NOT_STARTED"
  | "COMBAT_PLAYER_INACTIVE"
  | "INPUT_EXPIRED"
  | "INPUT_SEQUENCE_REPLAY"
  | "INVALID_COMBAT_COMMAND"
  | "INVALID_MOVEMENT"
  | "WEAPON_UNAVAILABLE";

export interface CombatRuleError {
  readonly code: CombatRuleErrorCode;
  readonly message: string;
}

export type CombatReduction =
  | {
      readonly accepted: true;
      readonly state: CombatState;
      readonly events: readonly CombatEvent[];
    }
  | {
      readonly accepted: false;
      readonly state: CombatState;
      readonly events: readonly [];
      readonly error: CombatRuleError;
    };

export interface CombatSimulationResult {
  readonly state: CombatState;
  readonly events: readonly CombatEvent[];
}
