import type {
  AuthorityDispatchResult,
  AuthorityEventListener,
  RemoteAuthorityTransport,
} from "@ningacademy/authority";
import type { GameState } from "@ningacademy/game-core";
import { PROTOCOL_VERSION, type CommandEnvelope } from "@ningacademy/protocol";

import type { WebRtcStarNetwork } from "./webrtc-star";

interface PendingCommand {
  readonly reject: (reason: Error) => void;
  readonly resolve: (result: AuthorityDispatchResult) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Non-host Authority transport. It can send commands but cannot publish state. */
export class WebRtcRemoteAuthorityTransport implements RemoteAuthorityTransport {
  readonly #events = new Set<AuthorityEventListener>();
  readonly #pending = new Map<string, PendingCommand>();
  readonly #unsubscribe: () => void;
  readonly #unsubscribeRealtime: () => void;
  #closed = false;
  #snapshot: Readonly<GameState> | null = null;

  constructor(private readonly network: WebRtcStarNetwork) {
    if (network.isHost) throw new Error("remote transport is only for non-host peers");
    this.#snapshot = network.getLatestGameState();
    this.#unsubscribe = network.subscribeControl((message) => {
      if (message.messageType === "game.command_result") {
        const pending = this.#pending.get(message.result.ack.commandId);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.#pending.delete(message.result.ack.commandId);
        pending.resolve(message.result);
      } else if (message.messageType === "game.event") {
        for (const listener of this.#events) listener(message.event);
      }
    });
    this.#unsubscribeRealtime = network.subscribeRealtime((message) => {
      if (message.messageType === "game.snapshot" && message.roomId === network.roomId) {
        if (this.#snapshot !== null && message.state.revision <= this.#snapshot.revision) return;
        this.#snapshot = message.state;
      }
    });
  }

  getSnapshot(): Readonly<GameState> {
    if (!this.#snapshot) throw new Error("host snapshot is not ready");
    return this.#snapshot;
  }

  send(envelope: CommandEnvelope): Promise<AuthorityDispatchResult> {
    if (this.#closed) return Promise.reject(new Error("transport is closed"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(envelope.commandId);
        reject(new Error("host command acknowledgement timed out"));
      }, 5_000);
      this.#pending.set(envelope.commandId, { reject, resolve, timer });
      try {
        this.network.sendControlToHost({
          command: envelope,
          messageType: "game.command",
          protocolVersion: PROTOCOL_VERSION,
        });
      } catch (error) {
        clearTimeout(timer);
        this.#pending.delete(envelope.commandId);
        reject(error instanceof Error ? error : new Error("host channel is unavailable"));
      }
    });
  }

  subscribe(listener: AuthorityEventListener): () => void {
    this.#events.add(listener);
    return () => this.#events.delete(listener);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#unsubscribe();
    this.#unsubscribeRealtime();
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("transport closed"));
    }
    this.#pending.clear();
    this.#events.clear();
  }
}
