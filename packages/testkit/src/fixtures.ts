import {
  advanceGameSimulation,
  createInitialGameState,
  reduceGameCommand,
  type GameCommand,
  type GameEvent,
  type GameState,
} from "@ningacademy/game-core";
import { createCommandEnvelope, type CommandEnvelope } from "@ningacademy/protocol";

export const TEST_RULESET_VERSION = "ruleset-test-v1";

export const TEST_USERS = {
  alice: { userId: "00000000-0000-4000-8000-000000000001", displayName: "Alice" },
  bob: { userId: "00000000-0000-4000-8000-000000000002", displayName: "Bob" },
} as const;

export interface TestStateOptions {
  readonly roomId?: string;
  readonly rulesetVersion?: string;
  readonly seed?: number | string;
  readonly nowMs?: number;
  readonly maxPlayers?: number;
}

export function createTestState(options: TestStateOptions = {}): GameState {
  return createInitialGameState({
    roomId: options.roomId ?? "test-room",
    rulesetVersion: options.rulesetVersion ?? TEST_RULESET_VERSION,
    seed: options.seed ?? "test-seed",
    nowMs: options.nowMs ?? 1_000,
    ...(options.maxPlayers === undefined ? {} : { maxPlayers: options.maxPlayers }),
  });
}

export interface AppliedTestCommand {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export interface ApplyTestCommandOptions {
  readonly commandId?: string;
  readonly atMs?: number;
  readonly expectedRevision?: number;
}

export function applyTestUserCommand(
  state: GameState,
  userId: string,
  command: GameCommand,
  options: ApplyTestCommandOptions = {},
): AppliedTestCommand {
  const result = reduceGameCommand(state, {
    commandId: options.commandId ?? `test-command-${state.revision + 1}`,
    atMs: options.atMs ?? state.createdAtMs + state.revision + 1,
    ...(options.expectedRevision === undefined
      ? {}
      : { expectedRevision: options.expectedRevision }),
    actor: { kind: "user", userId },
    command,
  });

  if (!result.accepted) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }

  return { state: result.state, events: result.events };
}

export function createReadyLobbyFixture(): GameState {
  let state = createTestState();
  state = applyTestUserCommand(state, TEST_USERS.alice.userId, {
    type: "player.join",
    displayName: TEST_USERS.alice.displayName,
  }).state;
  state = applyTestUserCommand(state, TEST_USERS.bob.userId, {
    type: "player.join",
    displayName: TEST_USERS.bob.displayName,
  }).state;
  state = applyTestUserCommand(state, TEST_USERS.alice.userId, {
    type: "player.ready",
    ready: true,
  }).state;
  state = applyTestUserCommand(state, TEST_USERS.bob.userId, {
    type: "player.ready",
    ready: true,
  }).state;
  return state;
}

export function createStartedRoomFixture(): GameState {
  const lobby = createReadyLobbyFixture();
  return applyTestUserCommand(lobby, TEST_USERS.alice.userId, { type: "room.start" }).state;
}

export interface StartedCombatFixture {
  readonly playerId: string;
  readonly state: GameState;
}

export function createStartedCombatFixture(): StartedCombatFixture {
  let state = createTestState({ maxPlayers: 1 });
  state = applyTestUserCommand(state, TEST_USERS.alice.userId, {
    type: "player.join",
    displayName: TEST_USERS.alice.displayName,
  }).state;
  state = applyTestUserCommand(state, TEST_USERS.alice.userId, {
    type: "player.ready",
    ready: true,
  }).state;
  state = applyTestUserCommand(state, TEST_USERS.alice.userId, { type: "room.start" }).state;
  return { playerId: TEST_USERS.alice.userId, state };
}

export function advanceTestCombat(state: GameState, tickCount = 1): AppliedTestCommand {
  const result = advanceGameSimulation(state, tickCount);
  return { state: result.state, events: result.events };
}

export interface TestEnvelopeOptions {
  readonly roomId?: string;
  readonly commandId?: string;
  readonly sentAtMs?: number;
  readonly expectedRevision?: number;
}

export function createTestCommandEnvelope(
  payload: GameCommand,
  options: TestEnvelopeOptions = {},
): CommandEnvelope {
  return createCommandEnvelope({
    roomId: options.roomId ?? "test-room",
    commandId: options.commandId ?? "test-command",
    sentAtMs: options.sentAtMs ?? 1_000,
    ...(options.expectedRevision === undefined
      ? {}
      : { expectedRevision: options.expectedRevision }),
    payload,
  });
}
