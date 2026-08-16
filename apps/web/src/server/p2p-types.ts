export type P2PSignalType = "offer" | "answer" | "ice";

export interface P2PMember {
  readonly connected: boolean;
  readonly displayName: string;
  readonly joinedAt: string;
  readonly memberId: string;
  readonly ready: boolean;
  readonly reconnectUntil: string;
}

export interface P2PSignal {
  readonly id: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly senderMemberId: string;
  readonly topologyEpoch: number;
  readonly type: P2PSignalType;
}

export interface P2PRoomJoin {
  readonly expiresAt: string;
  readonly hostMemberId: string;
  readonly memberId: string;
  readonly roomCode: string;
  readonly roomId: string;
  readonly topologyEpoch: number;
}

export interface P2PRoomSnapshot {
  readonly checkpoint: Readonly<Record<string, unknown>> | null;
  readonly checkpointSequence: number;
  readonly expiresAt: string;
  readonly forceExitAt: string;
  readonly hostMemberId: string | null;
  readonly maxPlayers: number;
  readonly memberId: string;
  readonly members: readonly P2PMember[];
  readonly roomCode: string;
  readonly roomId: string;
  readonly signals: readonly P2PSignal[];
  readonly status: "lobby" | "running" | "ended";
  readonly topologyEpoch: number;
}
