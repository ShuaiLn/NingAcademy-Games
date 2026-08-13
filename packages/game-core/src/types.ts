export const GAME_STATE_SCHEMA_VERSION = 1 as const;
export const MAX_RECENT_COMMAND_IDS = 128;

export type RoomId = string;
export type PlayerId = string;
export type UserId = string;

export type RoomStatus = "lobby" | "running" | "ended";
export type PlayerStatus = "lobby" | "active" | "left";
export type RoomEndReason = "host_request" | "admin_terminated" | "system_shutdown" | "empty";

export interface RandomState {
  readonly seed: number;
  readonly state: number;
  readonly draws: number;
}

export interface PlayerState {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly status: PlayerStatus;
  readonly ready: boolean;
  readonly joinedAtMs: number;
}

export interface GameState {
  readonly schemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
  readonly rulesetVersion: string;
  readonly roomId: RoomId;
  readonly status: RoomStatus;
  readonly revision: number;
  readonly maxPlayers: number;
  readonly createdAtMs: number;
  readonly startedAtMs: number | null;
  readonly endedAtMs: number | null;
  readonly endReason: RoomEndReason | null;
  readonly hostPlayerId: PlayerId | null;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly activePlayerIds: readonly PlayerId[];
  readonly turnOrder: readonly PlayerId[];
  readonly rng: RandomState;
  readonly recentCommandIds: readonly string[];
}

export type GameActor =
  | { readonly kind: "system" }
  | { readonly kind: "user"; readonly userId: UserId };

export type GameCommand =
  | { readonly type: "player.join"; readonly displayName: string }
  | { readonly type: "player.ready"; readonly ready: boolean }
  | { readonly type: "player.leave" }
  | { readonly type: "room.start" }
  | { readonly type: "room.end"; readonly reason: Exclude<RoomEndReason, "empty"> };

export type GameEvent =
  | {
      readonly type: "player.joined";
      readonly playerId: PlayerId;
      readonly displayName: string;
      readonly isHost: boolean;
    }
  | { readonly type: "player.ready_changed"; readonly playerId: PlayerId; readonly ready: boolean }
  | { readonly type: "player.left"; readonly playerId: PlayerId }
  | { readonly type: "host.changed"; readonly playerId: PlayerId | null }
  | { readonly type: "room.started"; readonly turnOrder: readonly PlayerId[] }
  | { readonly type: "room.ended"; readonly reason: RoomEndReason };

export interface GameCommandInput {
  readonly commandId: string;
  readonly atMs: number;
  readonly expectedRevision?: number;
  readonly actor: GameActor;
  readonly command: GameCommand;
}

export type GameRuleErrorCode =
  | "INVALID_ACTOR"
  | "INVALID_COMMAND"
  | "INVALID_DISPLAY_NAME"
  | "INVALID_ROOM_STATE"
  | "PLAYER_ALREADY_JOINED"
  | "PLAYER_NOT_FOUND"
  | "ROOM_FULL"
  | "NOT_HOST"
  | "PLAYERS_NOT_READY"
  | "REVISION_CONFLICT";

export interface GameRuleError {
  readonly code: GameRuleErrorCode;
  readonly message: string;
}

export type ReductionResult =
  | {
      readonly accepted: true;
      readonly duplicate: boolean;
      readonly state: GameState;
      readonly events: readonly GameEvent[];
    }
  | {
      readonly accepted: false;
      readonly state: GameState;
      readonly events: readonly [];
      readonly error: GameRuleError;
    };

export interface CreateGameStateOptions {
  readonly roomId: RoomId;
  readonly rulesetVersion: string;
  readonly seed: number | string;
  readonly nowMs: number;
  readonly maxPlayers?: number;
}
