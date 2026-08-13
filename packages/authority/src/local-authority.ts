import { reduceGameCommand, type GameCommand, type GameState } from "@ningacademy/game-core";
import {
  createAcceptedCommandAck,
  createCommandEnvelope,
  createEventEnvelopes,
  createRejectedCommandAck,
} from "@ningacademy/protocol";

import type {
  Authority,
  AuthorityClock,
  AuthorityDispatchOptions,
  AuthorityDispatchResult,
  AuthorityEventListener,
  CommandIdFactory,
} from "./types.js";

export interface LocalAuthorityOptions {
  readonly initialState: GameState;
  /** Local/offline identity only. Hosted identity is bound by the remote transport. */
  readonly authenticatedUserId: string;
  readonly clock?: AuthorityClock;
  readonly commandIdFactory?: CommandIdFactory;
}

export class LocalAuthority implements Authority {
  readonly roomId: string;

  readonly #authenticatedUserId: string;
  readonly #clock: AuthorityClock;
  readonly #commandIdFactory: CommandIdFactory;
  readonly #listeners = new Set<AuthorityEventListener>();
  #state: GameState;
  #sequence = 0;
  #closed = false;

  constructor(options: LocalAuthorityOptions) {
    const authenticatedUserId = options.authenticatedUserId.trim();
    if (authenticatedUserId.length === 0 || authenticatedUserId.length > 128) {
      throw new RangeError("authenticatedUserId must contain between 1 and 128 characters");
    }

    this.roomId = options.initialState.roomId;
    this.#state = options.initialState;
    this.#authenticatedUserId = authenticatedUserId;
    this.#clock = options.clock ?? (() => Date.now());
    this.#commandIdFactory =
      options.commandIdFactory ?? ((sequence) => `${this.roomId}:local-command:${sequence}`);
  }

  getSnapshot(): Readonly<GameState> {
    return this.#state;
  }

  dispatch(
    command: GameCommand,
    options: AuthorityDispatchOptions = {},
  ): Promise<AuthorityDispatchResult> {
    if (this.#closed) {
      throw new Error("Authority is closed");
    }

    this.#sequence += 1;
    const envelope = createCommandEnvelope({
      roomId: this.roomId,
      commandId: options.commandId ?? this.#commandIdFactory(this.#sequence),
      sentAtMs: this.#clock(),
      ...(options.expectedRevision === undefined
        ? {}
        : { expectedRevision: options.expectedRevision }),
      payload: command,
    });
    const result = reduceGameCommand(this.#state, {
      commandId: envelope.commandId,
      atMs: envelope.sentAtMs,
      ...(envelope.expectedRevision === undefined
        ? {}
        : { expectedRevision: envelope.expectedRevision }),
      actor: { kind: "user", userId: this.#authenticatedUserId },
      command: envelope.payload,
    });

    if (!result.accepted) {
      return Promise.resolve({
        ack: createRejectedCommandAck(envelope, result.state.revision, result.error),
        events: [],
      });
    }

    this.#state = result.state;
    const events = createEventEnvelopes({
      roomId: this.roomId,
      revision: result.state.revision,
      occurredAtMs: envelope.sentAtMs,
      events: result.events,
    });

    for (const event of events) {
      for (const listener of this.#listeners) {
        try {
          listener(event);
        } catch {
          // Listener failures are isolated from authoritative state transitions.
        }
      }
    }

    return Promise.resolve({
      ack: createAcceptedCommandAck(envelope, result.state.revision, result.duplicate),
      events,
    });
  }

  subscribe(listener: AuthorityEventListener): () => void {
    if (this.#closed) {
      throw new Error("Authority is closed");
    }

    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  close(): void {
    this.#closed = true;
    this.#listeners.clear();
  }
}
