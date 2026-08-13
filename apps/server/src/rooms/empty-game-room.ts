import { defineTypes, Schema } from "@colyseus/schema";
import { PROTOCOL_VERSION } from "@ningacademy/protocol";
import {
  Room,
  type AuthContext,
  type Client,
} from "@colyseus/core";

import {
  authorizeRoomHandshake,
  readRoomDefinition,
  type RoomAuthorization,
  type RoomDefinition,
} from "../handshake.js";

interface ServerHello {
  authoritativeTickRate: number;
  protocolVersion: typeof PROTOCOL_VERSION;
  roomId: string;
  serverTimeMs: number;
}

interface GameMessages {
  "server:hello": ServerHello;
}

type GameClient = Client<{
  auth: RoomAuthorization;
  messages: GameMessages;
}>;

export class EmptyGameState extends Schema {
  connectedClients = 0;
  phase = "waiting";
  protocolVersion: typeof PROTOCOL_VERSION = PROTOCOL_VERSION;
}

defineTypes(EmptyGameState, {
  connectedClients: "uint8",
  phase: "string",
  protocolVersion: "uint8",
});

export class EmptyGameRoom extends Room<{
  client: GameClient;
  metadata: {
    phase: string;
    protocolVersion: typeof PROTOCOL_VERSION;
  };
  state: EmptyGameState;
}> {
  override state = new EmptyGameState();
  private authoritativeTick = 0;

  override onCreate(rawOptions: unknown): void {
    readRoomDefinition(rawOptions);

    this.autoDispose = true;
    this.maxClients = 4;
    this.maxMessagesPerSecond = 64;
    this.patchRate = 1_000 / 15;
    this.state.protocolVersion = PROTOCOL_VERSION;
    this.metadata = {
      phase: this.state.phase,
      protocolVersion: this.state.protocolVersion,
    };
    this.setSimulationInterval(() => {
      this.authoritativeTick += 1;
    }, 1_000 / 30);
  }

  override onJoin(client: GameClient): void {
    this.state.connectedClients = this.clients.length;
    client.send("server:hello", {
      authoritativeTickRate: 30,
      protocolVersion: this.state.protocolVersion,
      roomId: this.roomId,
      serverTimeMs: Date.now(),
    });
  }

  override onLeave(): void {
    this.state.connectedClients = this.clients.length;
  }
}

export function createEmptyGameRoomClass(definition: RoomDefinition): typeof EmptyGameRoom {
  return class ConfiguredEmptyGameRoom extends EmptyGameRoom {
    static override onAuth(
      token: string,
      options: unknown,
      context: AuthContext,
    ): Promise<RoomAuthorization> {
      // Colyseus' token parameter is intentionally ignored. There is only one
      // game identity entry point: the host-only HttpOnly session cookie.
      void token;
      return authorizeRoomHandshake(options, context, definition);
    }
  };
}
