import type {
  GameCommand,
  GameEvent,
  GameRuleError,
  RoomEndReason,
} from "@ningacademy/game-core";
import { isCombatCommand, isCombatEvent } from "./combat.js";

export const PROTOCOL_VERSION = 1 as const;

const MAX_IDENTIFIER_LENGTH = 128;

export interface CommandEnvelope {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "game.command";
  readonly roomId: string;
  readonly commandId: string;
  readonly sentAtMs: number;
  readonly expectedRevision?: number;
  readonly payload: GameCommand;
}

export interface EventEnvelope {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "game.event";
  readonly eventId: string;
  readonly roomId: string;
  readonly revision: number;
  readonly eventIndex: number;
  readonly occurredAtMs: number;
  readonly payload: GameEvent;
}

export interface AcceptedCommandAckEnvelope {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "game.command_ack";
  readonly roomId: string;
  readonly commandId: string;
  readonly accepted: true;
  readonly duplicate: boolean;
  readonly revision: number;
}

export interface RejectedCommandAckEnvelope {
  readonly protocolVersion: typeof PROTOCOL_VERSION;
  readonly messageType: "game.command_ack";
  readonly roomId: string;
  readonly commandId: string;
  readonly accepted: false;
  readonly revision: number;
  readonly error: GameRuleError;
}

export type CommandAckEnvelope = AcceptedCommandAckEnvelope | RejectedCommandAckEnvelope;

export type EnvelopeDecodeErrorCode = "INVALID_ENVELOPE" | "UNSUPPORTED_PROTOCOL_VERSION";

export interface EnvelopeDecodeError {
  readonly code: EnvelopeDecodeErrorCode;
  readonly message: string;
}

export type DecodeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: EnvelopeDecodeError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): boolean {
  const keys = Object.keys(value);
  return required.every((key) => key in value) && keys.every((key) => required.includes(key) || optional.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_IDENTIFIER_LENGTH;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRoomEndReason(value: unknown): value is Exclude<RoomEndReason, "empty"> {
  return value === "host_request" || value === "admin_terminated" || value === "system_shutdown";
}

export function isGameCommand(value: unknown): value is GameCommand {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "player.join":
      return hasExactKeys(value, ["type", "displayName"]) && typeof value.displayName === "string";
    case "player.ready":
      return hasExactKeys(value, ["type", "ready"]) && typeof value.ready === "boolean";
    case "player.leave":
    case "room.start":
      return hasExactKeys(value, ["type"]);
    case "room.end":
      return hasExactKeys(value, ["type", "reason"]) && isRoomEndReason(value.reason);
    case "combat.input":
    case "combat.fire":
    case "combat.reload":
      return isCombatCommand(value);
    default:
      return false;
  }
}

function isGameEvent(value: unknown): value is GameEvent {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "player.joined":
      return (
        hasExactKeys(value, ["type", "playerId", "displayName", "isHost"]) &&
        isIdentifier(value.playerId) &&
        typeof value.displayName === "string" &&
        typeof value.isHost === "boolean"
      );
    case "player.ready_changed":
      return (
        hasExactKeys(value, ["type", "playerId", "ready"]) &&
        isIdentifier(value.playerId) &&
        typeof value.ready === "boolean"
      );
    case "player.left":
      return hasExactKeys(value, ["type", "playerId"]) && isIdentifier(value.playerId);
    case "host.changed":
      return (
        hasExactKeys(value, ["type", "playerId"]) &&
        (value.playerId === null || isIdentifier(value.playerId))
      );
    case "room.started":
      return (
        hasExactKeys(value, ["type", "turnOrder"]) &&
        Array.isArray(value.turnOrder) &&
        value.turnOrder.every(isIdentifier)
      );
    case "room.ended":
      return (
        hasExactKeys(value, ["type", "reason"]) &&
        (isRoomEndReason(value.reason) || value.reason === "empty")
      );
    case "combat.started":
    case "combat.shot_fired":
    case "combat.entity_damaged":
    case "combat.entity_killed":
    case "combat.death_cue":
    case "combat.entity_respawned":
      return isCombatEvent(value);
    default:
      return false;
  }
}

export interface CreateCommandEnvelopeOptions {
  readonly roomId: string;
  readonly commandId: string;
  readonly sentAtMs: number;
  readonly expectedRevision?: number;
  readonly payload: GameCommand;
}

export function createCommandEnvelope(options: CreateCommandEnvelopeOptions): CommandEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    messageType: "game.command",
    roomId: options.roomId,
    commandId: options.commandId,
    sentAtMs: options.sentAtMs,
    ...(options.expectedRevision === undefined ? {} : { expectedRevision: options.expectedRevision }),
    payload: options.payload,
  };
}

export interface CreateEventEnvelopesOptions {
  readonly roomId: string;
  readonly revision: number;
  readonly occurredAtMs: number;
  readonly events: readonly GameEvent[];
}

export function createEventEnvelopes(options: CreateEventEnvelopesOptions): readonly EventEnvelope[] {
  return options.events.map((payload, eventIndex) => ({
    protocolVersion: PROTOCOL_VERSION,
    messageType: "game.event",
    eventId: `${options.roomId}:${options.revision}:${eventIndex}`,
    roomId: options.roomId,
    revision: options.revision,
    eventIndex,
    occurredAtMs: options.occurredAtMs,
    payload,
  }));
}

export function createAcceptedCommandAck(
  envelope: CommandEnvelope,
  revision: number,
  duplicate: boolean,
): AcceptedCommandAckEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    messageType: "game.command_ack",
    roomId: envelope.roomId,
    commandId: envelope.commandId,
    accepted: true,
    duplicate,
    revision,
  };
}

export function createRejectedCommandAck(
  envelope: CommandEnvelope,
  revision: number,
  error: GameRuleError,
): RejectedCommandAckEnvelope {
  return {
    protocolVersion: PROTOCOL_VERSION,
    messageType: "game.command_ack",
    roomId: envelope.roomId,
    commandId: envelope.commandId,
    accepted: false,
    revision,
    error,
  };
}

export function isCommandEnvelope(value: unknown): value is CommandEnvelope {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      ["protocolVersion", "messageType", "roomId", "commandId", "sentAtMs", "payload"],
      ["expectedRevision"],
    )
  ) {
    return false;
  }

  return (
    value.protocolVersion === PROTOCOL_VERSION &&
    value.messageType === "game.command" &&
    isIdentifier(value.roomId) &&
    isIdentifier(value.commandId) &&
    isTimestamp(value.sentAtMs) &&
    (value.expectedRevision === undefined || isRevision(value.expectedRevision)) &&
    isGameCommand(value.payload)
  );
}

export function isEventEnvelope(value: unknown): value is EventEnvelope {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "protocolVersion",
      "messageType",
      "eventId",
      "roomId",
      "revision",
      "eventIndex",
      "occurredAtMs",
      "payload",
    ]) &&
    value.protocolVersion === PROTOCOL_VERSION &&
    value.messageType === "game.event" &&
    isIdentifier(value.eventId) &&
    isIdentifier(value.roomId) &&
    isRevision(value.revision) &&
    isRevision(value.eventIndex) &&
    isTimestamp(value.occurredAtMs) &&
    isGameEvent(value.payload)
  );
}

export function decodeCommandEnvelope(value: unknown): DecodeResult<CommandEnvelope> {
  if (isRecord(value) && value.protocolVersion !== PROTOCOL_VERSION) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_PROTOCOL_VERSION",
        message: `Expected protocol version ${PROTOCOL_VERSION}`,
      },
    };
  }

  if (!isCommandEnvelope(value)) {
    return {
      ok: false,
      error: { code: "INVALID_ENVELOPE", message: "The command envelope is malformed" },
    };
  }

  return { ok: true, value };
}
