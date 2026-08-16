import { NextResponse } from "next/server";

import type { GamesConfig } from "./config";
import { readOpaqueCookie } from "./game-session";
import { GamesDatabaseError, type GamesGateway } from "./postgres-games-gateway";
import { buildSessionCookie, validateLaunchRequest } from "./launch-ticket";
import type { P2PSignalType } from "./p2p-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

function noStoreHeaders(contentType = "application/json; charset=utf-8"): HeadersInit {
  return {
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    "Content-Type": contentType,
    Expires: "0",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  };
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { headers: noStoreHeaders(), status });
}

function databaseError(error: unknown): NextResponse {
  if (!(error instanceof GamesDatabaseError)) return json({ error: "service_unavailable" }, 503);
  const status = error.kind === "invalid" ? 401 : error.kind === "conflict" ? 409 : error.kind === "full" ? 409 : 503;
  return json({ error: error.kind }, status);
}

function sessionToken(request: Request, config: GamesConfig): string | null {
  if (request.headers.has("authorization")) return null;
  return readOpaqueCookie(request.headers.get("cookie"), config.gameSessionCookieName);
}

function isSameOriginMutation(request: Request, config: GamesConfig): boolean {
  const url = new URL(request.url);
  return url.search === ""
    && !request.headers.has("authorization")
    && request.headers.get("origin") === config.webOrigin
    && request.headers.get("sec-fetch-site") === "same-origin"
    && ["cors", "same-origin"].includes(request.headers.get("sec-fetch-mode") ?? "")
    && request.headers.get("sec-fetch-dest") === "empty"
    && (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

async function strictJson(request: Request, allowedKeys: readonly string[]): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 600_000) return null;
  try {
    const value: unknown = await request.json();
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    return Object.keys(record).every((key) => allowedKeys.includes(key)) ? record : null;
  } catch {
    return null;
  }
}

export async function handleRedeem(
  request: Request,
  config: GamesConfig,
  gateway: GamesGateway,
  now: () => Date = () => new Date(),
): Promise<NextResponse> {
  const url = new URL(request.url);
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (url.search !== "" || request.headers.has("authorization") || contentType !== "application/x-www-form-urlencoded") {
    return new NextResponse("Invalid game launch request.", { headers: noStoreHeaders("text/plain; charset=utf-8"), status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse("Invalid game launch request.", { headers: noStoreHeaders("text/plain; charset=utf-8"), status: 400 });
  }
  const ticket = form.get("ticket");
  if (
    [...form.keys()].length !== 1
    || !validateLaunchRequest(ticket, {
      origin: request.headers.get("origin"),
      secFetchDest: request.headers.get("sec-fetch-dest"),
      secFetchMode: request.headers.get("sec-fetch-mode"),
      secFetchSite: request.headers.get("sec-fetch-site"),
    }, config.mainOrigin)
  ) {
    return new NextResponse("Invalid game launch request.", { headers: noStoreHeaders("text/plain; charset=utf-8"), status: 400 });
  }

  const redemption = await gateway.redeem(ticket);
  if (redemption.kind === "rejected") {
    const unavailable = redemption.reason === "service_unavailable";
    return new NextResponse(
      unavailable ? "Game identity service is temporarily unavailable." : "This game launch has expired or was already used.",
      { headers: noStoreHeaders("text/plain; charset=utf-8"), status: unavailable ? 503 : 401 },
    );
  }

  const response = NextResponse.redirect(new URL("/", config.webOrigin), 303);
  for (const [name, value] of Object.entries(noStoreHeaders())) response.headers.set(name, String(value));
  response.headers.set("Set-Cookie", buildSessionCookie({
    cookieName: config.gameSessionCookieName,
    expiresAt: redemption.expiresAt,
    now: now(),
    rawSessionToken: redemption.rawSessionToken,
    secure: config.nodeEnv === "production",
  }));
  return response;
}

export async function handleSessionStatus(request: Request, config: GamesConfig, gateway: GamesGateway): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ authenticated: false }, 401);
  const result = await gateway.verify(token);
  if (result.kind === "rejected") {
    return json({ authenticated: false }, result.reason === "service_unavailable" ? 503 : 401);
  }
  return json({
    assignmentId: result.identity.assignmentId,
    authenticated: true,
    displayName: result.identity.displayName,
    expiresAt: result.identity.expiresAt.toISOString(),
    role: result.identity.role,
  });
}

export async function handleIceConfig(request: Request, config: GamesConfig, gateway: GamesGateway): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ error: "unauthenticated" }, 401);
  const result = await gateway.verify(token);
  if (result.kind === "rejected") return json({ error: result.reason }, result.reason === "invalid" ? 401 : 503);
  return json({ iceServers: config.iceServers, protocolVersion: config.protocolVersion });
}

export async function handleCreateRoom(request: Request, config: GamesConfig, gateway: GamesGateway): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ error: "unauthenticated" }, 401);
  if (!isSameOriginMutation(request, config)) return json({ error: "invalid_request" }, 400);
  const body = await strictJson(request, ["maxPlayers"]);
  const maxPlayers = body?.maxPlayers;
  if (!Number.isSafeInteger(maxPlayers) || Number(maxPlayers) < 2 || Number(maxPlayers) > 8) {
    return json({ error: "invalid_capacity" }, 400);
  }
  try {
    return json(await gateway.createRoom(token, Number(maxPlayers), config.protocolVersion, config.rulesetVersion), 201);
  } catch (error) {
    return databaseError(error);
  }
}

export async function handleJoinRoom(request: Request, config: GamesConfig, gateway: GamesGateway): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ error: "unauthenticated" }, 401);
  if (!isSameOriginMutation(request, config)) return json({ error: "invalid_request" }, 400);
  const body = await strictJson(request, ["roomCode"]);
  const roomCode = typeof body?.roomCode === "string" ? body.roomCode.trim().toUpperCase() : "";
  if (!ROOM_CODE_PATTERN.test(roomCode)) return json({ error: "invalid_room_code" }, 400);
  try {
    return json(await gateway.joinRoom(token, roomCode, config.protocolVersion));
  } catch (error) {
    return databaseError(error);
  }
}

export async function handlePollRoom(
  request: Request,
  roomId: string,
  config: GamesConfig,
  gateway: GamesGateway,
): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ error: "unauthenticated" }, 401);
  const url = new URL(request.url);
  if (!UUID_PATTERN.test(roomId) || [...url.searchParams.keys()].some((key) => key !== "after")) {
    return json({ error: "invalid_request" }, 400);
  }
  const afterValue = url.searchParams.get("after") ?? "0";
  if (!/^\d{1,16}$/.test(afterValue)) return json({ error: "invalid_cursor" }, 400);
  const after = Number(afterValue);
  if (!Number.isSafeInteger(after)) return json({ error: "invalid_cursor" }, 400);
  try {
    return json(await gateway.pollRoom(token, roomId, after));
  } catch (error) {
    return databaseError(error);
  }
}

export async function handleRoomAction(
  request: Request,
  roomId: string,
  config: GamesConfig,
  gateway: GamesGateway,
): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ error: "unauthenticated" }, 401);
  if (!UUID_PATTERN.test(roomId) || !isSameOriginMutation(request, config)) return json({ error: "invalid_request" }, 400);
  const body = await strictJson(request, ["action", "ready", "topologyEpoch", "sequence", "checkpoint"]);
  const action = body?.action;
  try {
    if (action === "ready" && typeof body?.ready === "boolean" && Object.keys(body).length === 2) {
      await gateway.setReady(token, roomId, body.ready);
    } else if (action === "start" && Object.keys(body ?? {}).length === 1) {
      await gateway.startRoom(token, roomId);
    } else if (action === "leave" && Object.keys(body ?? {}).length === 1) {
      await gateway.leaveRoom(token, roomId);
    } else if (action === "end" && Object.keys(body ?? {}).length === 1) {
      await gateway.endRoom(token, roomId);
    } else if (
      action === "checkpoint"
      && Number.isSafeInteger(body?.topologyEpoch)
      && Number.isSafeInteger(body?.sequence)
      && Number(body?.sequence) > 0
      && typeof body?.checkpoint === "object"
      && body.checkpoint !== null
      && !Array.isArray(body.checkpoint)
      && Object.keys(body).length === 4
    ) {
      await gateway.saveCheckpoint(
        token,
        roomId,
        Number(body.topologyEpoch),
        Number(body.sequence),
        body.checkpoint as Readonly<Record<string, unknown>>,
      );
    } else {
      return json({ error: "invalid_action" }, 400);
    }
    return json({ ok: true });
  } catch (error) {
    return databaseError(error);
  }
}

export async function handleSendSignal(
  request: Request,
  roomId: string,
  config: GamesConfig,
  gateway: GamesGateway,
): Promise<NextResponse> {
  const token = sessionToken(request, config);
  if (!token) return json({ error: "unauthenticated" }, 401);
  if (!UUID_PATTERN.test(roomId) || !isSameOriginMutation(request, config)) return json({ error: "invalid_request" }, 400);
  const body = await strictJson(request, ["targetMemberId", "topologyEpoch", "type", "payload"]);
  const type = body?.type;
  if (
    typeof body?.targetMemberId !== "string"
    || !UUID_PATTERN.test(body.targetMemberId)
    || !Number.isSafeInteger(body.topologyEpoch)
    || !["offer", "answer", "ice"].includes(String(type))
    || typeof body.payload !== "object"
    || body.payload === null
    || Array.isArray(body.payload)
    || Object.keys(body).length !== 4
  ) return json({ error: "invalid_signal" }, 400);
  try {
    const signalId = await gateway.sendSignal(
      token,
      roomId,
      body.targetMemberId,
      Number(body.topologyEpoch),
      type as P2PSignalType,
      body.payload as Readonly<Record<string, unknown>>,
    );
    return json({ signalId }, 201);
  } catch (error) {
    return databaseError(error);
  }
}
