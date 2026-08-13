import {
  COMBAT_TICK_RATE,
  isCombatCommandShape,
  type CombatCommand,
  type CombatEvent,
} from "@ningacademy/game-core";

const MAX_IDENTIFIER_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === required.length && keys.every((key) => required.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isBiome(value: unknown): boolean {
  return value === "house" || value === "grassland" || value === "desert" || value === "hell";
}

function isVector2(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["x", "z"]) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.z)
  );
}

function isQuantizedPosition(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => Number.isSafeInteger(coordinate))
  );
}

export function isCombatCommand(value: unknown): value is CombatCommand {
  return isCombatCommandShape(value);
}

export function isCombatDeathCueEvent(
  value: unknown,
): value is Extract<CombatEvent, { type: "combat.death_cue" }> {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["type", "biome", "entityId", "pos", "seed"]) &&
    value.type === "combat.death_cue" &&
    isBiome(value.biome) &&
    isIdentifier(value.entityId) &&
    isQuantizedPosition(value.pos) &&
    isNonNegativeInteger(value.seed) &&
    value.seed <= 0xffff_ffff
  );
}

export function isCombatEvent(value: unknown): value is CombatEvent {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "combat.started":
      return (
        hasExactKeys(value, [
          "type",
          "biome",
          "seed",
          "thrallId",
          "thrallPosition",
          "tickRate",
        ]) &&
        isBiome(value.biome) &&
        isNonNegativeInteger(value.seed) &&
        value.seed <= 0xffff_ffff &&
        isIdentifier(value.thrallId) &&
        isVector2(value.thrallPosition) &&
        value.tickRate === COMBAT_TICK_RATE
      );
    case "combat.shot_fired":
      return (
        hasExactKeys(value, [
          "type",
          "ammoRemaining",
          "evaluatedAtMs",
          "hit",
          "playerId",
          "rewindClamped",
          "shotSequence",
        ]) &&
        isNonNegativeInteger(value.ammoRemaining) &&
        isFiniteNumber(value.evaluatedAtMs) &&
        typeof value.hit === "boolean" &&
        isIdentifier(value.playerId) &&
        typeof value.rewindClamped === "boolean" &&
        isNonNegativeInteger(value.shotSequence)
      );
    case "combat.entity_damaged":
      return (
        hasExactKeys(value, [
          "type",
          "amount",
          "remainingHp",
          "sourceEntityId",
          "targetEntityId",
        ]) &&
        isFiniteNumber(value.amount) &&
        value.amount > 0 &&
        isFiniteNumber(value.remainingHp) &&
        value.remainingHp >= 0 &&
        isIdentifier(value.sourceEntityId) &&
        isIdentifier(value.targetEntityId)
      );
    case "combat.entity_killed":
      return (
        hasExactKeys(value, [
          "type",
          "entityId",
          "entityKind",
          "killerPlayerId",
          "tick",
        ]) &&
        isIdentifier(value.entityId) &&
        (value.entityKind === "survivor" || value.entityKind === "thrall") &&
        (value.killerPlayerId === null || isIdentifier(value.killerPlayerId)) &&
        isNonNegativeInteger(value.tick)
      );
    case "combat.death_cue":
      return isCombatDeathCueEvent(value);
    case "combat.entity_respawned":
      return (
        hasExactKeys(value, ["type", "entityId", "entityKind", "position", "tick"]) &&
        isIdentifier(value.entityId) &&
        (value.entityKind === "survivor" || value.entityKind === "thrall") &&
        isVector2(value.position) &&
        isNonNegativeInteger(value.tick)
      );
    default:
      return false;
  }
}
