import { createRandomState, shuffle } from "./prng.js";
import {
  advanceCombatTicks,
  createCombatStartedEvent,
  createCombatState,
  createWaveStartedEvent,
  reduceCombatCommand,
} from "./combat.js";
import type { CombatCommand, CombatEvent } from "./combat-types.js";
import {
  GAME_STATE_SCHEMA_VERSION,
  MAX_RECENT_COMMAND_IDS,
  type CreateGameStateOptions,
  type GameActor,
  type GameCommandInput,
  type GameEvent,
  type GameRuleErrorCode,
  type GameState,
  type PlayerId,
  type PlayerState,
  type ReductionResult,
  type RoomEndReason,
} from "./types.js";

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 8;
const MAX_DISPLAY_NAME_LENGTH = 32;
const MAX_IDENTIFIER_LENGTH = 128;

function assertInitialOptions(options: CreateGameStateOptions): void {
  const maxPlayers = options.maxPlayers ?? 4;

  if (options.roomId.length === 0 || options.roomId.length > MAX_IDENTIFIER_LENGTH) {
    throw new RangeError("roomId must contain between 1 and 128 characters");
  }

  if (options.rulesetVersion.length === 0 || options.rulesetVersion.length > MAX_IDENTIFIER_LENGTH) {
    throw new RangeError("rulesetVersion must contain between 1 and 128 characters");
  }

  if (!Number.isSafeInteger(options.nowMs) || options.nowMs < 0) {
    throw new RangeError("nowMs must be a non-negative safe integer");
  }

  if (!Number.isSafeInteger(maxPlayers) || maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
    throw new RangeError("maxPlayers must be an integer between 1 and 8");
  }
}

export function createInitialGameState(options: CreateGameStateOptions): GameState {
  assertInitialOptions(options);

  return {
    schemaVersion: GAME_STATE_SCHEMA_VERSION,
    rulesetVersion: options.rulesetVersion,
    roomId: options.roomId,
    status: "lobby",
    revision: 0,
    maxPlayers: options.maxPlayers ?? 4,
    createdAtMs: options.nowMs,
    startedAtMs: null,
    endedAtMs: null,
    endReason: null,
    hostPlayerId: null,
    players: {},
    activePlayerIds: [],
    turnOrder: [],
    combat: null,
    combatBiome: options.combatBiome ?? "house",
    rng: createRandomState(options.seed),
    recentCommandIds: [],
  };
}

function reject(state: GameState, code: GameRuleErrorCode, message: string): ReductionResult {
  return {
    accepted: false,
    state,
    events: [],
    error: { code, message },
  };
}

function rememberCommand(state: GameState, commandId: string): readonly string[] {
  const commandIds = [...state.recentCommandIds, commandId];
  return commandIds.slice(Math.max(0, commandIds.length - MAX_RECENT_COMMAND_IDS));
}

function accept(
  state: GameState,
  commandId: string,
  patch: Partial<GameState>,
  events: readonly GameEvent[],
): ReductionResult {
  return {
    accepted: true,
    duplicate: false,
    state: {
      ...state,
      ...patch,
      revision: state.revision + 1,
      recentCommandIds: rememberCommand(state, commandId),
    },
    events,
  };
}

function userPlayerId(actor: GameActor): PlayerId | null {
  if (actor.kind !== "user") {
    return null;
  }

  const userId = actor.userId.trim();
  return userId.length > 0 && userId.length <= MAX_IDENTIFIER_LENGTH ? userId : null;
}

function activePlayers(state: GameState): readonly PlayerId[] {
  return state.activePlayerIds.filter((playerId) => state.players[playerId]?.status !== "left");
}

function withoutPlayer<T>(record: Readonly<Record<string, T>>, playerId: PlayerId): Readonly<Record<string, T>> {
  const result: Record<string, T> = { ...record };
  delete result[playerId];
  return result;
}

function reduceJoin(state: GameState, input: GameCommandInput): ReductionResult {
  if (state.status !== "lobby") {
    return reject(state, "INVALID_ROOM_STATE", "Players may only join a lobby");
  }

  const playerId = userPlayerId(input.actor);
  if (playerId === null) {
    return reject(state, "INVALID_ACTOR", "Joining requires an authenticated user actor");
  }

  const displayName = input.command.type === "player.join" ? input.command.displayName.trim() : "";
  if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return reject(state, "INVALID_DISPLAY_NAME", "Display name must contain between 1 and 32 characters");
  }

  const existing = state.players[playerId];
  if (existing !== undefined && existing.status !== "left") {
    return reject(state, "PLAYER_ALREADY_JOINED", "The authenticated player is already in this room");
  }

  const currentPlayers = activePlayers(state);
  if (currentPlayers.length >= state.maxPlayers) {
    return reject(state, "ROOM_FULL", "The room has reached its player limit");
  }

  const isHost = state.hostPlayerId === null;
  const player: PlayerState = {
    playerId,
    displayName,
    status: "lobby",
    ready: false,
    joinedAtMs: input.atMs,
  };

  return accept(
    state,
    input.commandId,
    {
      hostPlayerId: isHost ? playerId : state.hostPlayerId,
      players: { ...state.players, [playerId]: player },
      activePlayerIds: [...currentPlayers, playerId],
    },
    [{ type: "player.joined", playerId, displayName, isHost }],
  );
}

function reduceReady(state: GameState, input: GameCommandInput): ReductionResult {
  if (state.status !== "lobby") {
    return reject(state, "INVALID_ROOM_STATE", "Readiness may only change in a lobby");
  }

  const playerId = userPlayerId(input.actor);
  if (playerId === null) {
    return reject(state, "INVALID_ACTOR", "Changing readiness requires an authenticated user actor");
  }

  const player = state.players[playerId];
  if (player === undefined || player.status !== "lobby") {
    return reject(state, "PLAYER_NOT_FOUND", "The authenticated player is not in this lobby");
  }

  const ready = input.command.type === "player.ready" && input.command.ready;
  const updatedPlayer: PlayerState = { ...player, ready };

  return accept(
    state,
    input.commandId,
    { players: { ...state.players, [playerId]: updatedPlayer } },
    [{ type: "player.ready_changed", playerId, ready }],
  );
}

function reduceStart(state: GameState, input: GameCommandInput): ReductionResult {
  if (state.status !== "lobby") {
    return reject(state, "INVALID_ROOM_STATE", "Only a lobby may be started");
  }

  const playerId = userPlayerId(input.actor);
  if (playerId === null) {
    return reject(state, "INVALID_ACTOR", "Starting a room requires an authenticated user actor");
  }

  if (state.hostPlayerId !== playerId) {
    return reject(state, "NOT_HOST", "Only the authenticated room host may start the room");
  }

  const currentPlayers = activePlayers(state);
  const allReady =
    currentPlayers.length > 0 && currentPlayers.every((id) => state.players[id]?.ready === true);
  if (!allReady) {
    return reject(state, "PLAYERS_NOT_READY", "Every active player must be ready before the room starts");
  }

  const orderDraw = shuffle(state.rng, currentPlayers);
  const combat = createCombatState({
    biome: state.combatBiome,
    playerIds: currentPlayers,
    seed: `${state.roomId}:${orderDraw.state.state}:combat-v1`,
    startedAtMs: input.atMs,
  });
  const players = { ...state.players };
  for (const id of currentPlayers) {
    const player = players[id];
    if (player !== undefined) {
      players[id] = { ...player, status: "active" };
    }
  }

  return accept(
    state,
    input.commandId,
    {
      status: "running",
      startedAtMs: input.atMs,
      players,
      turnOrder: orderDraw.value,
      combat,
      rng: orderDraw.state,
    },
    [
      { type: "room.started", turnOrder: orderDraw.value },
      createCombatStartedEvent(combat),
      createWaveStartedEvent(combat),
    ],
  );
}

function reduceCombat(
  state: GameState,
  input: GameCommandInput,
  command: CombatCommand,
): ReductionResult {
  if (state.status !== "running" || state.combat === null) {
    return reject(state, "COMBAT_NOT_STARTED", "Combat commands require a running room");
  }

  const playerId = userPlayerId(input.actor);
  if (playerId === null) {
    return reject(state, "INVALID_ACTOR", "Combat commands require an authenticated user actor");
  }

  const result = reduceCombatCommand(state.combat, playerId, command);
  if (!result.accepted) {
    return reject(state, result.error.code, result.error.message);
  }

  return accept(state, input.commandId, { combat: result.state }, result.events);
}

function reduceLeave(state: GameState, input: GameCommandInput): ReductionResult {
  if (state.status === "ended") {
    return reject(state, "INVALID_ROOM_STATE", "An ended room cannot be left again");
  }

  const playerId = userPlayerId(input.actor);
  if (playerId === null) {
    return reject(state, "INVALID_ACTOR", "Leaving requires an authenticated user actor");
  }

  const player = state.players[playerId];
  if (player === undefined || player.status === "left") {
    return reject(state, "PLAYER_NOT_FOUND", "The authenticated player is not active in this room");
  }

  const remainingPlayerIds = activePlayers(state).filter((id) => id !== playerId);
  const players = {
    ...state.players,
    [playerId]: { ...player, status: "left" as const, ready: false },
  };
  const hostChanged = state.hostPlayerId === playerId;
  const nextHost = hostChanged ? (remainingPlayerIds[0] ?? null) : state.hostPlayerId;
  const events: GameEvent[] = [{ type: "player.left", playerId }];

  if (hostChanged) {
    events.push({ type: "host.changed", playerId: nextHost });
  }

  const roomBecameEmpty = state.status === "running" && remainingPlayerIds.length === 0;
  const combat = state.combat === null
    ? null
    : {
        ...state.combat,
        history: state.combat.history.map((frame) => ({
          ...frame,
          survivors: withoutPlayer(frame.survivors, playerId),
        })),
        survivors: withoutPlayer(state.combat.survivors, playerId),
      };
  if (roomBecameEmpty) {
    events.push({ type: "room.ended", reason: "empty" });
  }

  return accept(
    state,
    input.commandId,
    {
      status: roomBecameEmpty ? "ended" : state.status,
      endedAtMs: roomBecameEmpty ? input.atMs : state.endedAtMs,
      endReason: roomBecameEmpty ? "empty" : state.endReason,
      hostPlayerId: nextHost,
      players,
      activePlayerIds: remainingPlayerIds,
      turnOrder: state.turnOrder.filter((id) => id !== playerId),
      combat,
    },
    events,
  );
}

function reduceEnd(state: GameState, input: GameCommandInput): ReductionResult {
  if (state.status === "ended") {
    return reject(state, "INVALID_ROOM_STATE", "The room has already ended");
  }

  if (input.command.type !== "room.end") {
    return reject(state, "INVALID_COMMAND", "Expected a room.end command");
  }

  let reason: RoomEndReason;
  if (input.actor.kind === "user") {
    const playerId = userPlayerId(input.actor);
    if (playerId === null || state.hostPlayerId !== playerId) {
      return reject(state, "NOT_HOST", "Only the authenticated room host may end the room");
    }
    if (input.command.reason !== "host_request") {
      return reject(state, "INVALID_COMMAND", "A user may only end a room with host_request");
    }
    reason = "host_request";
  } else {
    if (input.command.reason === "host_request") {
      return reject(state, "INVALID_COMMAND", "A system actor must use a system end reason");
    }
    reason = input.command.reason;
  }

  return accept(
    state,
    input.commandId,
    { status: "ended", endedAtMs: input.atMs, endReason: reason },
    [{ type: "room.ended", reason }],
  );
}

export function reduceGameCommand(state: GameState, input: GameCommandInput): ReductionResult {
  if (
    input.commandId.length === 0 ||
    input.commandId.length > MAX_IDENTIFIER_LENGTH ||
    !Number.isSafeInteger(input.atMs) ||
    input.atMs < 0
  ) {
    return reject(state, "INVALID_COMMAND", "Command metadata is invalid");
  }

  if (state.recentCommandIds.includes(input.commandId)) {
    return {
      accepted: true,
      duplicate: true,
      state,
      events: [],
    };
  }

  if (input.expectedRevision !== undefined && input.expectedRevision !== state.revision) {
    return reject(state, "REVISION_CONFLICT", "The command expected a different room revision");
  }

  switch (input.command.type) {
    case "player.join":
      return reduceJoin(state, input);
    case "player.ready":
      return reduceReady(state, input);
    case "player.leave":
      return reduceLeave(state, input);
    case "room.start":
      return reduceStart(state, input);
    case "room.end":
      return reduceEnd(state, input);
    case "combat.input":
    case "combat.fire":
    case "combat.reload":
      return reduceCombat(state, input, input.command);
    default: {
      const exhaustiveCommand: never = input.command;
      return reject(state, "INVALID_COMMAND", `Unknown command: ${String(exhaustiveCommand)}`);
    }
  }
}

export interface GameSimulationResult {
  readonly state: GameState;
  readonly events: readonly CombatEvent[];
}

/** Host-only fixed-step seam. Non-host peers cannot submit tick commands. */
export function advanceGameSimulation(state: GameState, tickCount = 1): GameSimulationResult {
  if (state.status !== "running" || state.combat === null) {
    throw new Error("Cannot advance combat before the room is running");
  }

  const result = advanceCombatTicks(state.combat, tickCount);
  return {
    events: result.events,
    state: {
      ...state,
      combat: result.state,
      revision: state.revision + tickCount,
    },
  };
}
