import {
  advanceGameSimulation,
  createInitialGameState,
  GAME_STATE_SCHEMA_VERSION,
  isCompatibleCombatMapLayout,
  reduceGameCommand,
  type CreateGameStateOptions,
  type GameState,
} from "@ningacademy/game-core";
import {
  createAcceptedCommandAck,
  createEventEnvelopes,
  createRejectedCommandAck,
  type CommandEnvelope,
} from "@ningacademy/protocol";

import type { AuthorityDispatchResult, AuthorityEventListener, RemoteAuthorityTransport } from "./types.js";

export interface HostMemberIdentity {
  readonly displayName: string;
  readonly memberId: string;
}

export type HostSnapshotListener = (state: Readonly<GameState>) => void;

/**
 * Pure host-side simulation seam. A peer's actor id comes from the signaling
 * membership bound to its RTCDataChannel, never from the command packet.
 * Host cheating is an accepted product risk; non-host authoritative state is
 * still rejected structurally by exposing commands only through this method.
 */
export class HostP2PAuthorityRuntime {
  readonly #eventListeners = new Set<AuthorityEventListener>();
  readonly #snapshotListeners = new Set<HostSnapshotListener>();
  #state: GameState;

  constructor(initialState: GameState) {
    this.#state = initialState;
  }

  static create(options: CreateGameStateOptions): HostP2PAuthorityRuntime {
    return new HostP2PAuthorityRuntime(createInitialGameState(options));
  }

  getSnapshot(): Readonly<GameState> {
    return this.#state;
  }

  attachMember(identity: HostMemberIdentity, nowMs = Date.now()): void {
    const existing = this.#state.players[identity.memberId];
    if (existing !== undefined && existing.status !== "left") return;
    const result = reduceGameCommand(this.#state, {
      actor: { kind: "user", userId: identity.memberId },
      atMs: nowMs,
      command: { displayName: identity.displayName, type: "player.join" },
      commandId: `${this.#state.roomId}:attach:${identity.memberId}:${this.#state.revision}`,
    });
    if (!result.accepted) throw new Error(result.error.message);
    this.#accept(result.state, createEventEnvelopes({
      events: result.events,
      occurredAtMs: nowMs,
      revision: result.state.revision,
      roomId: this.#state.roomId,
    }));
  }

  detachMember(memberId: string, nowMs = Date.now()): void {
    const existing = this.#state.players[memberId];
    if (existing === undefined || existing.status === "left" || this.#state.status === "ended") return;
    const result = reduceGameCommand(this.#state, {
      actor: { kind: "user", userId: memberId },
      atMs: nowMs,
      command: { type: "player.leave" },
      commandId: `${this.#state.roomId}:detach:${memberId}:${this.#state.revision}`,
    });
    if (!result.accepted) throw new Error(result.error.message);
    this.#accept(result.state, createEventEnvelopes({
      events: result.events,
      occurredAtMs: nowMs,
      revision: result.state.revision,
      roomId: this.#state.roomId,
    }));
  }

  processCommand(memberId: string, envelope: CommandEnvelope, nowMs = Date.now()): AuthorityDispatchResult {
    if (envelope.roomId !== this.#state.roomId || this.#state.players[memberId]?.status === "left") {
      throw new Error("command channel is not bound to an active room member");
    }
    if (envelope.payload.type === "player.join") {
      throw new Error("room membership is controlled by the signaling service");
    }
    const reduced = reduceGameCommand(this.#state, {
      actor: { kind: "user", userId: memberId },
      atMs: nowMs,
      command: envelope.payload,
      commandId: envelope.commandId,
      ...(envelope.expectedRevision === undefined ? {} : { expectedRevision: envelope.expectedRevision }),
    });
    if (!reduced.accepted) {
      return { ack: createRejectedCommandAck(envelope, reduced.state.revision, reduced.error), events: [] };
    }
    const events = createEventEnvelopes({
      events: reduced.events,
      occurredAtMs: nowMs,
      revision: reduced.state.revision,
      roomId: this.#state.roomId,
    });
    this.#accept(reduced.state, events);
    return { ack: createAcceptedCommandAck(envelope, reduced.state.revision, reduced.duplicate), events };
  }

  restoreCheckpoint(checkpoint: unknown): void {
    if (
      typeof checkpoint !== "object" || checkpoint === null || Array.isArray(checkpoint)
      || (checkpoint as { schemaVersion?: unknown }).schemaVersion !== GAME_STATE_SCHEMA_VERSION
      || (checkpoint as { roomId?: unknown }).roomId !== this.#state.roomId
      || !Number.isSafeInteger((checkpoint as { revision?: unknown }).revision)
    ) throw new Error("host checkpoint is invalid");
    const candidate = checkpoint as GameState;
    if (
      candidate.combat !== null
      && (
        !isCompatibleCombatMapLayout(candidate.combat.map)
        || !Number.isSafeInteger(candidate.combat.enemyRevision)
        || candidate.combat.enemyRevision < 0
        || !Number.isSafeInteger(candidate.combat.wave.revision)
        || candidate.combat.wave.revision < 0
      )
    ) throw new Error("host checkpoint world state is invalid");
    this.#state = candidate;
    this.#emitSnapshot();
  }

  /** Advances the fixed-step world. This method is only owned by the elected Host. */
  advanceSimulation(tickCount = 1): void {
    const result = advanceGameSimulation(this.#state, tickCount);
    const events = createEventEnvelopes({
      events: result.events,
      occurredAtMs: result.state.combat?.timeMs ?? Date.now(),
      revision: result.state.revision,
      roomId: this.#state.roomId,
    });
    this.#accept(result.state, events);
  }

  subscribe(listener: AuthorityEventListener): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  subscribeSnapshots(listener: HostSnapshotListener): () => void {
    this.#snapshotListeners.add(listener);
    return () => this.#snapshotListeners.delete(listener);
  }

  #accept(state: GameState, events: AuthorityDispatchResult["events"]): void {
    this.#state = state;
    for (const event of events) for (const listener of this.#eventListeners) listener(event);
    this.#emitSnapshot();
  }

  #emitSnapshot(): void {
    for (const listener of this.#snapshotListeners) listener(this.#state);
  }
}

/** Binds the local host UI to the same runtime used for remote peers. */
export class HostP2PAuthorityTransport implements RemoteAuthorityTransport {
  constructor(
    private readonly runtime: HostP2PAuthorityRuntime,
    private readonly hostMemberId: string,
  ) {}

  getSnapshot(): Readonly<GameState> { return this.runtime.getSnapshot(); }
  send(envelope: CommandEnvelope): Promise<AuthorityDispatchResult> {
    return Promise.resolve(this.runtime.processCommand(this.hostMemberId, envelope));
  }
  subscribe(listener: AuthorityEventListener): () => void { return this.runtime.subscribe(listener); }
  close(): void {}
}
