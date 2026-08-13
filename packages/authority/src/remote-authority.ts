import type { GameCommand, GameState } from "@ningacademy/game-core";
import { createCommandEnvelope } from "@ningacademy/protocol";

import type {
  Authority,
  AuthorityClock,
  AuthorityDispatchOptions,
  AuthorityDispatchResult,
  AuthorityEventListener,
  CommandIdFactory,
  RemoteAuthorityTransport,
} from "./types.js";

export interface RemoteAuthorityOptions {
  readonly roomId: string;
  /** This transport must already be authenticated by the opaque game session. */
  readonly transport: RemoteAuthorityTransport;
  readonly clock?: AuthorityClock;
  readonly commandIdFactory?: CommandIdFactory;
}

/**
 * Transport-agnostic remote facade. It deliberately has no user-id option and
 * therefore cannot create a second client-controlled identity path.
 */
export class RemoteAuthority implements Authority {
  readonly roomId: string;

  readonly #transport: RemoteAuthorityTransport;
  readonly #clock: AuthorityClock;
  readonly #commandIdFactory: CommandIdFactory;
  #sequence = 0;
  #closed = false;

  constructor(options: RemoteAuthorityOptions) {
    if (options.roomId.length === 0 || options.roomId.length > 128) {
      throw new RangeError("roomId must contain between 1 and 128 characters");
    }

    this.roomId = options.roomId;
    this.#transport = options.transport;
    this.#clock = options.clock ?? (() => Date.now());
    this.#commandIdFactory =
      options.commandIdFactory ?? ((sequence) => `${this.roomId}:remote-command:${sequence}`);
  }

  getSnapshot(): Readonly<GameState> {
    return this.#transport.getSnapshot();
  }

  async dispatch(
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
    const result = await this.#transport.send(envelope);

    if (result.ack.roomId !== this.roomId || result.ack.commandId !== envelope.commandId) {
      throw new Error("Remote authority returned an acknowledgement for a different command");
    }

    return result;
  }

  subscribe(listener: AuthorityEventListener): () => void {
    if (this.#closed) {
      throw new Error("Authority is closed");
    }

    return this.#transport.subscribe(listener);
  }

  close(): void {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#transport.close();
  }
}
