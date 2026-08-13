import type { GameCommand, GameState } from "@ningacademy/game-core";
import type { CommandAckEnvelope, CommandEnvelope, EventEnvelope } from "@ningacademy/protocol";

export interface AuthorityDispatchOptions {
  readonly commandId?: string;
  readonly expectedRevision?: number;
}

export interface AuthorityDispatchResult {
  readonly ack: CommandAckEnvelope;
  readonly events: readonly EventEnvelope[];
}

export type AuthorityEventListener = (event: EventEnvelope) => void;

/**
 * An Authority is already bound to one authenticated session. Dispatch callers
 * intentionally cannot supply a user id; hosted identity is resolved before a
 * RemoteAuthority transport is created.
 */
export interface Authority {
  readonly roomId: string;
  getSnapshot(): Readonly<GameState>;
  dispatch(command: GameCommand, options?: AuthorityDispatchOptions): Promise<AuthorityDispatchResult>;
  subscribe(listener: AuthorityEventListener): () => void;
  close(): void;
}

/**
 * Implementations must authenticate out of band (opaque game session / socket)
 * and must never infer identity from CommandEnvelope payload data.
 */
export interface RemoteAuthorityTransport {
  getSnapshot(): Readonly<GameState>;
  send(envelope: CommandEnvelope): Promise<AuthorityDispatchResult>;
  subscribe(listener: AuthorityEventListener): () => void;
  close(): void;
}

export type AuthorityClock = () => number;
export type CommandIdFactory = (sequence: number) => string;
