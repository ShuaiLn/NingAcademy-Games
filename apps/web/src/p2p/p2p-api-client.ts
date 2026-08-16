import type { P2PRoomJoin, P2PRoomSnapshot, P2PSignalType } from "@/server/p2p-types";

export interface SessionStatus {
  readonly assignmentId: string;
  readonly authenticated: true;
  readonly displayName: string;
  readonly expiresAt: string;
  readonly role: "student";
}

export class P2PApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function responseJson<T>(response: Response): Promise<T> {
  let body: unknown = null;
  try { body = await response.json(); } catch { /* fail below */ }
  if (!response.ok) {
    const code = typeof body === "object" && body !== null && "error" in body
      ? String(body.error)
      : `HTTP ${response.status}`;
    throw new P2PApiError(response.status, code);
  }
  return body as T;
}

async function post<T>(path: string, body: Readonly<Record<string, unknown>>): Promise<T> {
  return responseJson<T>(await fetch(path, {
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }));
}

export class P2PApiClient {
  session(): Promise<SessionStatus> {
    return fetch("/api/session", { cache: "no-store", credentials: "same-origin" }).then(responseJson<SessionStatus>);
  }

  iceConfig(): Promise<{ readonly iceServers: readonly RTCIceServer[]; readonly protocolVersion: number }> {
    return fetch("/api/p2p/ice", { cache: "no-store", credentials: "same-origin" })
      .then(responseJson<{ readonly iceServers: readonly RTCIceServer[]; readonly protocolVersion: number }>);
  }

  createRoom(maxPlayers: number): Promise<P2PRoomJoin> {
    return post<P2PRoomJoin>("/api/p2p/rooms", { maxPlayers });
  }

  joinRoom(roomCode: string): Promise<P2PRoomJoin> {
    return post<P2PRoomJoin>("/api/p2p/rooms/join", { roomCode });
  }

  pollRoom(roomId: string, afterSignalId: number): Promise<P2PRoomSnapshot> {
    return fetch(`/api/p2p/rooms/${encodeURIComponent(roomId)}?after=${afterSignalId}`, {
      cache: "no-store",
      credentials: "same-origin",
    }).then(responseJson<P2PRoomSnapshot>);
  }

  setReady(roomId: string, ready: boolean): Promise<{ readonly ok: true }> {
    return post(`/api/p2p/rooms/${encodeURIComponent(roomId)}`, { action: "ready", ready });
  }

  startRoom(roomId: string): Promise<{ readonly ok: true }> {
    return post(`/api/p2p/rooms/${encodeURIComponent(roomId)}`, { action: "start" });
  }

  leaveRoom(roomId: string): Promise<{ readonly ok: true }> {
    return post(`/api/p2p/rooms/${encodeURIComponent(roomId)}`, { action: "leave" });
  }

  endRoom(roomId: string): Promise<{ readonly ok: true }> {
    return post(`/api/p2p/rooms/${encodeURIComponent(roomId)}`, { action: "end" });
  }

  saveCheckpoint(
    roomId: string,
    topologyEpoch: number,
    sequence: number,
    checkpoint: Readonly<Record<string, unknown>>,
  ): Promise<{ readonly ok: true }> {
    return post(`/api/p2p/rooms/${encodeURIComponent(roomId)}`, {
      action: "checkpoint",
      checkpoint,
      sequence,
      topologyEpoch,
    });
  }

  sendSignal(
    roomId: string,
    targetMemberId: string,
    topologyEpoch: number,
    type: P2PSignalType,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<{ readonly signalId: number }> {
    return post(`/api/p2p/rooms/${encodeURIComponent(roomId)}/signals`, {
      payload,
      targetMemberId,
      topologyEpoch,
      type,
    });
  }
}
