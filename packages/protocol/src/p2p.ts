import type { GameState } from "@ningacademy/game-core";

import {
  PROTOCOL_VERSION,
  isCommandEnvelope,
  isEventEnvelope,
  type CommandAckEnvelope,
  type CommandEnvelope,
  type EventEnvelope,
} from "./envelopes.js";

export interface P2PCommandResult {
  readonly ack: CommandAckEnvelope;
  readonly events: readonly EventEnvelope[];
}

export const P2P_CONTROL_CHANNEL = "ning-control-v1" as const;
export const P2P_REALTIME_CHANNEL = "ning-realtime-v1" as const;
export const MAX_P2P_PACKET_BYTES = 65_536;

export type P2PControlMessage =
  | {
      readonly protocolVersion: typeof PROTOCOL_VERSION;
      readonly messageType: "peer.hello";
      readonly memberId: string;
      readonly roomId: string;
      readonly topologyEpoch: number;
    }
  | {
      readonly protocolVersion: typeof PROTOCOL_VERSION;
      readonly messageType: "game.command";
      readonly command: CommandEnvelope;
    }
  | {
      readonly protocolVersion: typeof PROTOCOL_VERSION;
      readonly messageType: "game.command_result";
      readonly result: P2PCommandResult;
    }
  | {
      readonly protocolVersion: typeof PROTOCOL_VERSION;
      readonly messageType: "game.event";
      readonly event: EventEnvelope;
    };

export type P2PRealtimeMessage =
  | {
      readonly protocolVersion: typeof PROTOCOL_VERSION;
      readonly messageType: "game.snapshot";
      readonly roomId: string;
      readonly revision: number;
      readonly state: GameState;
    }
  | {
      readonly protocolVersion: typeof PROTOCOL_VERSION;
      readonly messageType: "player.input";
      readonly inputSequence: number;
      readonly payload: Readonly<Record<string, number | boolean>>;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isGameState(value: unknown): value is GameState {
  return isRecord(value)
    && value.schemaVersion === 1
    && isIdentifier(value.roomId)
    && isRevision(value.revision)
    && isRecord(value.players);
}

function utf8ByteLength(value: string): number {
  let length = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    length += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return length;
}

function isDispatchResult(value: unknown): value is P2PCommandResult {
  return isRecord(value)
    && isRecord(value.ack)
    && typeof value.ack.commandId === "string"
    && typeof value.ack.roomId === "string"
    && Array.isArray(value.events)
    && value.events.every(isEventEnvelope);
}

export function encodeP2PPacket(message: P2PControlMessage | P2PRealtimeMessage): string {
  const encoded = JSON.stringify(message);
  if (utf8ByteLength(encoded) > MAX_P2P_PACKET_BYTES) {
    throw new RangeError("P2P packet exceeds the 64 KiB protocol ceiling");
  }
  return encoded;
}

export function decodeP2PControlPacket(raw: unknown): P2PControlMessage | null {
  if (typeof raw !== "string" || utf8ByteLength(raw) > MAX_P2P_PACKET_BYTES) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION || typeof value.messageType !== "string") return null;

  if (value.messageType === "peer.hello") {
    return exactKeys(value, ["protocolVersion", "messageType", "memberId", "roomId", "topologyEpoch"])
      && isIdentifier(value.memberId) && isIdentifier(value.roomId)
      && Number.isSafeInteger(value.topologyEpoch) && Number(value.topologyEpoch) > 0
      ? value as unknown as P2PControlMessage
      : null;
  }
  if (value.messageType === "game.command") {
    return exactKeys(value, ["protocolVersion", "messageType", "command"])
      && isCommandEnvelope(value.command) ? value as unknown as P2PControlMessage : null;
  }
  if (value.messageType === "game.command_result") {
    return exactKeys(value, ["protocolVersion", "messageType", "result"])
      && isDispatchResult(value.result) ? value as unknown as P2PControlMessage : null;
  }
  if (value.messageType === "game.event") {
    return exactKeys(value, ["protocolVersion", "messageType", "event"])
      && isEventEnvelope(value.event) ? value as unknown as P2PControlMessage : null;
  }
  return null;
}

export function decodeP2PRealtimePacket(raw: unknown): P2PRealtimeMessage | null {
  if (typeof raw !== "string" || utf8ByteLength(raw) > MAX_P2P_PACKET_BYTES) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.protocolVersion !== PROTOCOL_VERSION || typeof value.messageType !== "string") return null;

  if (value.messageType === "game.snapshot") {
    return exactKeys(value, ["protocolVersion", "messageType", "roomId", "revision", "state"])
      && isIdentifier(value.roomId) && isRevision(value.revision) && isGameState(value.state)
      && value.state.roomId === value.roomId && value.state.revision === value.revision
      ? value as unknown as P2PRealtimeMessage
      : null;
  }
  if (value.messageType === "player.input") {
    if (!exactKeys(value, ["protocolVersion", "messageType", "inputSequence", "payload"])
        || !isRevision(value.inputSequence) || !isRecord(value.payload)) return null;
    const validPayload = Object.values(value.payload).every((item) => typeof item === "number" || typeof item === "boolean");
    return validPayload ? value as unknown as P2PRealtimeMessage : null;
  }
  return null;
}
