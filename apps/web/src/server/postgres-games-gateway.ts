import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import type { GamesConfig } from "./config";
import {
  GAME_SESSION_TOKEN_PATTERN,
  type AuthenticatedGameIdentity,
  type GameSessionVerifier,
  type SessionVerificationResult,
} from "./game-session";
import {
  LAUNCH_TICKET_PATTERN,
  type LaunchTicketRedeemer,
  type LaunchTicketRedemption,
} from "./launch-ticket";
import type { P2PRoomJoin, P2PRoomSnapshot, P2PSignalType } from "./p2p-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export class GamesDatabaseError extends Error {
  constructor(
    readonly kind: "invalid" | "conflict" | "full" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

interface RedemptionRow extends QueryResultRow {
  force_exit_at: Date | string;
  game_session_token: string;
}

interface VerificationRow extends QueryResultRow {
  assignment_id: string;
  auth_session_id: string;
  force_exit_at: Date | string;
  launch_context: unknown;
  user_id: string;
}

interface RoomJoinRow extends QueryResultRow {
  expires_at: Date | string;
  host_member_id: string;
  member_id: string;
  normalized_room_code?: string;
  room_code?: string;
  room_id: string;
  topology_epoch: number;
}

interface RoomPollRow extends QueryResultRow {
  checkpoint_payload: unknown;
  checkpoint_sequence: string | number;
  expires_at: Date | string;
  force_exit_at: Date | string;
  host_member_id: string | null;
  max_players: number;
  member_id: string;
  members: unknown;
  room_code: string;
  room_id: string;
  room_status: "lobby" | "running" | "ended";
  signals: unknown;
  topology_epoch: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function futureIso(value: unknown): string | null {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now() ? null : date.toISOString();
}

function mapDatabaseError(error: unknown): GamesDatabaseError {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  if (code === "28000") return new GamesDatabaseError("invalid", "Games session or room is invalid");
  if (code === "22023") return new GamesDatabaseError("invalid", "The request is invalid");
  if (code === "22000") return new GamesDatabaseError("conflict", "The room state changed");
  if (code === "54000") return new GamesDatabaseError("full", "The room is full");
  return new GamesDatabaseError("unavailable", "The Games database is temporarily unavailable");
}

function parseIdentity(row: VerificationRow | undefined): AuthenticatedGameIdentity | null {
  if (!row || !UUID_PATTERN.test(row.auth_session_id) || !UUID_PATTERN.test(row.user_id)
      || !UUID_PATTERN.test(row.assignment_id) || !isRecord(row.launch_context)
      || !isRecord(row.launch_context.profile)) return null;
  const expiresAt = futureIso(row.force_exit_at);
  const profile = row.launch_context.profile;
  if (!expiresAt || profile.id !== row.user_id || profile.role !== "student"
      || typeof profile.displayName !== "string" || profile.displayName.trim() === "") return null;
  return {
    assignmentId: row.assignment_id,
    displayName: profile.displayName,
    expiresAt: new Date(expiresAt),
    gameSessionId: row.auth_session_id,
    role: "student",
    userId: row.user_id,
  };
}

function parseJoin(row: RoomJoinRow | undefined): P2PRoomJoin {
  const code = row?.room_code ?? row?.normalized_room_code;
  const expiresAt = futureIso(row?.expires_at);
  if (!row || !UUID_PATTERN.test(row.room_id) || !UUID_PATTERN.test(row.member_id)
      || !UUID_PATTERN.test(row.host_member_id) || !ROOM_CODE_PATTERN.test(code ?? "")
      || !Number.isSafeInteger(row.topology_epoch) || !expiresAt) {
    throw new GamesDatabaseError("unavailable", "The room RPC returned an invalid contract");
  }
  return {
    expiresAt,
    hostMemberId: row.host_member_id,
    memberId: row.member_id,
    roomCode: code!,
    roomId: row.room_id,
    topologyEpoch: row.topology_epoch,
  };
}

function parseSnapshot(row: RoomPollRow | undefined): P2PRoomSnapshot {
  const expiresAt = futureIso(row?.expires_at);
  const forceExitAt = futureIso(row?.force_exit_at);
  if (!row || !UUID_PATTERN.test(row.room_id) || !UUID_PATTERN.test(row.member_id)
      || (row.host_member_id !== null && !UUID_PATTERN.test(row.host_member_id))
      || !ROOM_CODE_PATTERN.test(row.room_code) || !Array.isArray(row.members)
      || !Array.isArray(row.signals) || !expiresAt || !forceExitAt
      || !Number.isSafeInteger(row.topology_epoch)) {
    throw new GamesDatabaseError("unavailable", "The polling RPC returned an invalid contract");
  }
  return {
    checkpoint: isRecord(row.checkpoint_payload) ? row.checkpoint_payload : null,
    checkpointSequence: Number(row.checkpoint_sequence),
    expiresAt,
    forceExitAt,
    hostMemberId: row.host_member_id,
    maxPlayers: row.max_players,
    memberId: row.member_id,
    members: row.members as P2PRoomSnapshot["members"],
    roomCode: row.room_code,
    roomId: row.room_id,
    signals: row.signals as P2PRoomSnapshot["signals"],
    status: row.room_status,
    topologyEpoch: row.topology_epoch,
  };
}

export interface GamesGateway extends LaunchTicketRedeemer, GameSessionVerifier {
  createRoom(token: string, maxPlayers: number, protocolVersion: number, rulesetVersion: string): Promise<P2PRoomJoin>;
  endRoom(token: string, roomId: string): Promise<void>;
  joinRoom(token: string, roomCode: string, protocolVersion: number): Promise<P2PRoomJoin>;
  leaveRoom(token: string, roomId: string): Promise<void>;
  pollRoom(token: string, roomId: string, afterSignalId: number): Promise<P2PRoomSnapshot>;
  saveCheckpoint(token: string, roomId: string, topologyEpoch: number, sequence: number, checkpoint: Readonly<Record<string, unknown>>): Promise<void>;
  sendSignal(token: string, roomId: string, targetMemberId: string, topologyEpoch: number, type: P2PSignalType, payload: Readonly<Record<string, unknown>>): Promise<number>;
  setReady(token: string, roomId: string, ready: boolean): Promise<void>;
  startRoom(token: string, roomId: string): Promise<void>;
}

class UnavailableGamesGateway implements GamesGateway {
  private unavailable(): GamesDatabaseError { return new GamesDatabaseError("unavailable", "Games database is not configured"); }
  createRoom(): Promise<P2PRoomJoin> { return Promise.reject(this.unavailable()); }
  endRoom(): Promise<void> { return Promise.reject(this.unavailable()); }
  joinRoom(): Promise<P2PRoomJoin> { return Promise.reject(this.unavailable()); }
  leaveRoom(): Promise<void> { return Promise.reject(this.unavailable()); }
  pollRoom(): Promise<P2PRoomSnapshot> { return Promise.reject(this.unavailable()); }
  redeem(): Promise<LaunchTicketRedemption> { return Promise.resolve({ kind: "rejected", reason: "service_unavailable" }); }
  saveCheckpoint(): Promise<void> { return Promise.reject(this.unavailable()); }
  sendSignal(): Promise<number> { return Promise.reject(this.unavailable()); }
  setReady(): Promise<void> { return Promise.reject(this.unavailable()); }
  startRoom(): Promise<void> { return Promise.reject(this.unavailable()); }
  verify(): Promise<SessionVerificationResult> { return Promise.resolve({ kind: "rejected", reason: "service_unavailable" }); }
}

export class PostgresGamesGateway implements GamesGateway {
  constructor(private readonly pool: Pool, private readonly role: "games_api" | null) {}

  private async query<Row extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<readonly Row[]> {
    let client: PoolClient | null = null;
    try {
      client = await this.pool.connect();
      await client.query("begin read write");
      if (this.role !== null) await client.query("set local role games_api");
      const result = await client.query<Row>(text, [...values]);
      await client.query("commit");
      return result.rows;
    } catch (error) {
      if (client !== null) await client.query("rollback").catch(() => undefined);
      throw mapDatabaseError(error);
    } finally {
      client?.release();
    }
  }

  async redeem(ticket: string): Promise<LaunchTicketRedemption> {
    if (!LAUNCH_TICKET_PATTERN.test(ticket)) return { kind: "rejected", reason: "invalid" };
    try {
      const rows = await this.query<RedemptionRow>(
        "select game_session_token, force_exit_at from game.redeem_game_launch_ticket_v1($1, $2)",
        [ticket, randomUUID()],
      );
      const row = rows[0];
      const expiresAt = futureIso(row?.force_exit_at);
      if (!row || !expiresAt || !GAME_SESSION_TOKEN_PATTERN.test(row.game_session_token)) {
        return { kind: "rejected", reason: "service_unavailable" };
      }
      return { kind: "redeemed", expiresAt: new Date(expiresAt), rawSessionToken: row.game_session_token };
    } catch (error) {
      return { kind: "rejected", reason: error instanceof GamesDatabaseError && error.kind === "invalid" ? "invalid" : "service_unavailable" };
    }
  }

  async verify(token: string): Promise<SessionVerificationResult> {
    if (!GAME_SESSION_TOKEN_PATTERN.test(token)) return { kind: "rejected", reason: "invalid" };
    try {
      const rows = await this.query<VerificationRow>(
        "select auth_session_id, user_id, assignment_id, force_exit_at, launch_context from game.validate_game_session_v2($1)",
        [token],
      );
      const identity = parseIdentity(rows[0]);
      return identity ? { kind: "authenticated", identity } : { kind: "rejected", reason: "service_unavailable" };
    } catch (error) {
      return { kind: "rejected", reason: error instanceof GamesDatabaseError && error.kind === "invalid" ? "invalid" : "service_unavailable" };
    }
  }

  async createRoom(token: string, maxPlayers: number, protocolVersion: number, rulesetVersion: string): Promise<P2PRoomJoin> {
    try {
      return parseJoin((await this.query<RoomJoinRow>(
        "select * from game.create_p2p_room_v1($1, $2, $3::smallint, $4::smallint, $5)",
        [token, randomUUID(), maxPlayers, protocolVersion, rulesetVersion],
      ))[0]);
    } catch (error) { throw error instanceof GamesDatabaseError ? error : mapDatabaseError(error); }
  }

  async joinRoom(token: string, roomCode: string, protocolVersion: number): Promise<P2PRoomJoin> {
    try {
      return parseJoin((await this.query<RoomJoinRow>(
        "select * from game.join_p2p_room_v1($1, $2, $3, $4::smallint)",
        [token, randomUUID(), roomCode, protocolVersion],
      ))[0]);
    } catch (error) { throw error instanceof GamesDatabaseError ? error : mapDatabaseError(error); }
  }

  async pollRoom(token: string, roomId: string, afterSignalId: number): Promise<P2PRoomSnapshot> {
    try {
      return parseSnapshot((await this.query<RoomPollRow>(
        "select * from game.poll_p2p_room_v1($1, $2::uuid, $3::bigint)",
        [token, roomId, afterSignalId],
      ))[0]);
    } catch (error) { throw error instanceof GamesDatabaseError ? error : mapDatabaseError(error); }
  }

  async sendSignal(token: string, roomId: string, targetMemberId: string, topologyEpoch: number, type: P2PSignalType, payload: Readonly<Record<string, unknown>>): Promise<number> {
    const rows = await this.query<{ send_p2p_signal_v1: string | number } & QueryResultRow>(
      "select game.send_p2p_signal_v1($1, $2::uuid, $3::uuid, $4, $5, $6, $7::jsonb)",
      [token, roomId, targetMemberId, randomUUID(), topologyEpoch, type, JSON.stringify(payload)],
    );
    const id = Number(rows[0]?.send_p2p_signal_v1);
    if (!Number.isSafeInteger(id) || id <= 0) throw new GamesDatabaseError("unavailable", "Invalid signal id");
    return id;
  }

  setReady(token: string, roomId: string, ready: boolean): Promise<void> {
    return this.voidCall("select game.set_p2p_ready_v1($1, $2::uuid, $3)", [token, roomId, ready]);
  }
  startRoom(token: string, roomId: string): Promise<void> {
    return this.voidCall("select game.start_p2p_room_v1($1, $2::uuid)", [token, roomId]);
  }
  leaveRoom(token: string, roomId: string): Promise<void> {
    return this.voidCall("select game.leave_p2p_room_v1($1, $2::uuid)", [token, roomId]);
  }
  endRoom(token: string, roomId: string): Promise<void> {
    return this.voidCall("select game.end_p2p_room_v1($1, $2::uuid)", [token, roomId]);
  }
  saveCheckpoint(token: string, roomId: string, topologyEpoch: number, sequence: number, checkpoint: Readonly<Record<string, unknown>>): Promise<void> {
    return this.voidCall(
      "select game.save_p2p_checkpoint_v1($1, $2::uuid, $3, $4::bigint, $5::jsonb)",
      [token, roomId, topologyEpoch, sequence, JSON.stringify(checkpoint)],
    );
  }

  private async voidCall(text: string, values: readonly unknown[]): Promise<void> {
    await this.query(text, values);
  }
}

const globalGateway = globalThis as typeof globalThis & { ningGamesGateway?: GamesGateway };

export function getGamesGateway(config: GamesConfig): GamesGateway {
  if (globalGateway.ningGamesGateway) return globalGateway.ningGamesGateway;
  if (!config.databaseUrl) return new UnavailableGamesGateway();
  const pool = new Pool({
    allowExitOnIdle: true,
    application_name: "ningacademy-games-vercel",
    connectionString: config.databaseUrl,
    max: 4,
    statement_timeout: 5_000,
  });
  pool.on("error", () => undefined);
  const gateway = new PostgresGamesGateway(pool, config.databaseRole);
  if (config.nodeEnv !== "production") globalGateway.ningGamesGateway = gateway;
  return gateway;
}
