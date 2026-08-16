import { HostP2PAuthorityRuntime } from "@ningacademy/authority";
import { COMBAT_TICK_RATE, type GameState } from "@ningacademy/game-core";
import {
  P2P_CONTROL_CHANNEL,
  P2P_REALTIME_CHANNEL,
  PROTOCOL_VERSION,
  createCommandEnvelope,
  decodeP2PControlPacket,
  decodeP2PRealtimePacket,
  encodeP2PPacket,
  type P2PControlMessage,
  type P2PRealtimeMessage,
} from "@ningacademy/protocol";

import type { P2PMember, P2PRoomJoin, P2PRoomSnapshot, P2PSignal } from "@/server/p2p-types";
import type { P2PApiClient } from "./p2p-api-client";

export type PeerConnectionState = "connecting" | "connected" | "disconnected" | "failed";

export interface StarNetworkStatus {
  readonly error: string | null;
  readonly hostMemberId: string | null;
  readonly isHost: boolean;
  readonly members: readonly P2PMember[];
  readonly peers: Readonly<Record<string, PeerConnectionState>>;
  readonly roomStatus: "lobby" | "running" | "ended";
  readonly topologyEpoch: number;
}

interface PeerLink {
  control: RTCDataChannel | null;
  readonly id: string;
  pendingIce: RTCIceCandidateInit[];
  readonly pc: RTCPeerConnection;
  realtime: RTCDataChannel | null;
}

type ControlListener = (message: P2PControlMessage) => void;
type RealtimeListener = (message: P2PRealtimeMessage) => void;
type SnapshotListener = (state: P2PRoomSnapshot) => void;

const POLL_INTERVAL_MS = 750;
const CHECKPOINT_INTERVAL_MS = 5_000;
const SNAPSHOT_INTERVAL_MS = 1_000 / 15;

function channelOpen(channel: RTCDataChannel | null): channel is RTCDataChannel {
  return channel !== null && channel.readyState === "open";
}

export class WebRtcStarNetwork {
  readonly #api: P2PApiClient;
  readonly #controlListeners = new Set<ControlListener>();
  readonly #iceServers: readonly RTCIceServer[];
  readonly #links = new Map<string, PeerLink>();
  readonly #realtimeListeners = new Set<RealtimeListener>();
  readonly #room: P2PRoomJoin;
  readonly #snapshotListeners = new Set<SnapshotListener>();
  readonly #statusListeners = new Set<(status: StarNetworkStatus) => void>();
  #authority: HostP2PAuthorityRuntime | null = null;
  #checkpointTimer: ReturnType<typeof setTimeout> | null = null;
  #closed = false;
  #hostMemberId: string | null;
  #lastSignalId = 0;
  #members: readonly P2PMember[] = [];
  #latestCheckpointState: Readonly<GameState> | null = null;
  #lastSnapshotBroadcastMs = 0;
  #pollTimer: ReturnType<typeof setTimeout> | null = null;
  #polling = false;
  #roomStatus: StarNetworkStatus["roomStatus"] = "lobby";
  #simulationTimer: ReturnType<typeof setInterval> | null = null;
  #topologyEpoch: number;

  constructor(options: {
    readonly api: P2PApiClient;
    readonly iceServers: readonly RTCIceServer[];
    readonly room: P2PRoomJoin;
  }) {
    this.#api = options.api;
    this.#iceServers = options.iceServers;
    this.#room = options.room;
    this.#hostMemberId = options.room.hostMemberId;
    this.#topologyEpoch = options.room.topologyEpoch;
  }

  get roomId(): string { return this.#room.roomId; }
  get roomCode(): string { return this.#room.roomCode; }
  get memberId(): string { return this.#room.memberId; }
  get isHost(): boolean { return this.#hostMemberId === this.memberId; }
  get hostAuthority(): HostP2PAuthorityRuntime | null { return this.#authority; }

  async start(): Promise<void> {
    if (this.#closed) throw new Error("network is closed");
    await this.#poll();
  }

  subscribeStatus(listener: (status: StarNetworkStatus) => void): () => void {
    this.#statusListeners.add(listener);
    listener(this.#status());
    return () => this.#statusListeners.delete(listener);
  }

  subscribeControl(listener: ControlListener): () => void {
    this.#controlListeners.add(listener);
    return () => this.#controlListeners.delete(listener);
  }

  subscribeRoom(listener: SnapshotListener): () => void {
    this.#snapshotListeners.add(listener);
    return () => this.#snapshotListeners.delete(listener);
  }

  subscribeRealtime(listener: RealtimeListener): () => void {
    this.#realtimeListeners.add(listener);
    return () => this.#realtimeListeners.delete(listener);
  }

  sendControlToHost(message: P2PControlMessage): void {
    if (this.isHost) throw new Error("the local member is the host");
    const link = this.#hostMemberId ? this.#links.get(this.#hostMemberId) : undefined;
    if (!link || !channelOpen(link.control)) throw new Error("host control channel is not connected");
    link.control.send(encodeP2PPacket(message));
  }

  sendRealtimeInput(payload: Readonly<Record<string, number | boolean>>, inputSequence: number): void {
    if (this.isHost) return;
    const link = this.#hostMemberId ? this.#links.get(this.#hostMemberId) : undefined;
    if (!link || !channelOpen(link.realtime)) return;
    link.realtime.send(encodeP2PPacket({
      inputSequence,
      messageType: "player.input",
      payload,
      protocolVersion: PROTOCOL_VERSION,
    }));
  }

  async close(leaveRoom = true): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    if (this.#pollTimer) clearTimeout(this.#pollTimer);
    if (this.#checkpointTimer) clearTimeout(this.#checkpointTimer);
    if (this.#simulationTimer) clearInterval(this.#simulationTimer);
    this.#closeLinks();
    if (leaveRoom) await this.#api.leaveRoom(this.roomId).catch(() => undefined);
  }

  async #poll(): Promise<void> {
    if (this.#closed || this.#polling) return;
    this.#polling = true;
    try {
      const snapshot = await this.#api.pollRoom(this.roomId, this.#lastSignalId);
      await this.#applyRoomSnapshot(snapshot);
      for (const signal of snapshot.signals) {
        this.#lastSignalId = Math.max(this.#lastSignalId, signal.id);
        await this.#handleSignal(signal);
      }
    } catch (error) {
      this.#emitStatus(error instanceof Error ? error.message : "P2P signaling is unavailable");
    } finally {
      this.#polling = false;
      if (!this.#closed) this.#pollTimer = setTimeout(() => void this.#poll(), POLL_INTERVAL_MS);
    }
  }

  async #applyRoomSnapshot(snapshot: P2PRoomSnapshot): Promise<void> {
    const topologyChanged = snapshot.topologyEpoch !== this.#topologyEpoch
      || snapshot.hostMemberId !== this.#hostMemberId;
    this.#members = snapshot.members;
    this.#roomStatus = snapshot.status;
    if (topologyChanged) {
      this.#closeLinks();
      this.#topologyEpoch = snapshot.topologyEpoch;
      this.#hostMemberId = snapshot.hostMemberId;
      this.#authority = null;
      this.#stopSimulationLoop();
      this.#lastSignalId = 0;
    }

    if (this.isHost) {
      this.#ensureHostAuthority(snapshot);
      this.#syncHostLobby(snapshot);
      for (const member of snapshot.members) {
        if (member.memberId !== this.memberId && member.connected && !this.#links.has(member.memberId)) {
          await this.#createHostLink(member.memberId);
        }
      }
      for (const [peerId, link] of this.#links) {
        if (!snapshot.members.some((member) => member.memberId === peerId && member.connected)) {
          link.pc.close();
          this.#links.delete(peerId);
        }
      }
      this.#syncSimulationLoop();
    } else {
      this.#stopSimulationLoop();
      for (const [peerId, link] of this.#links) {
        if (peerId !== snapshot.hostMemberId) {
          link.pc.close();
          this.#links.delete(peerId);
        }
      }
    }

    for (const listener of this.#snapshotListeners) listener(snapshot);
    this.#emitStatus(null);
  }

  #ensureHostAuthority(snapshot: P2PRoomSnapshot): void {
    if (this.#authority !== null) return;
    this.#authority = HostP2PAuthorityRuntime.create({
      maxPlayers: snapshot.maxPlayers,
      nowMs: Date.now(),
      roomId: snapshot.roomId,
      rulesetVersion: "p0",
      seed: snapshot.roomCode,
    });
    if (snapshot.checkpoint !== null) this.#authority.restoreCheckpoint(snapshot.checkpoint);
    this.#authority.subscribe((event) => {
      this.#broadcastControl({ event, messageType: "game.event", protocolVersion: PROTOCOL_VERSION });
    });
    this.#authority.subscribeSnapshots((state) => {
      this.#scheduleCheckpoint(state);
      const now = performance.now();
      if (now - this.#lastSnapshotBroadcastMs < SNAPSHOT_INTERVAL_MS) return;
      this.#lastSnapshotBroadcastMs = now;
      const message: P2PRealtimeMessage = {
        messageType: "game.snapshot",
        protocolVersion: PROTOCOL_VERSION,
        revision: state.revision,
        roomId: state.roomId,
        state,
      };
      this.#broadcastRealtime(message);
    });
  }

  #syncHostLobby(snapshot: P2PRoomSnapshot): void {
    const authority = this.#authority;
    if (!authority || authority.getSnapshot().status !== "lobby") return;
    for (const member of snapshot.members) {
      authority.attachMember({ displayName: member.displayName, memberId: member.memberId });
      const player = authority.getSnapshot().players[member.memberId];
      if (player && player.ready !== member.ready) {
        authority.processCommand(member.memberId, createCommandEnvelope({
          commandId: `${snapshot.roomId}:ready-sync:${member.memberId}:${snapshot.topologyEpoch}:${Number(member.ready)}`,
          payload: { ready: member.ready, type: "player.ready" },
          roomId: snapshot.roomId,
          sentAtMs: Date.now(),
        }));
      }
    }
    if (snapshot.status === "running" && authority.getSnapshot().status === "lobby") {
      authority.processCommand(this.memberId, createCommandEnvelope({
        commandId: `${snapshot.roomId}:start:${snapshot.topologyEpoch}`,
        payload: { type: "room.start" },
        roomId: snapshot.roomId,
        sentAtMs: Date.now(),
      }));
    }
  }

  async #createHostLink(peerId: string): Promise<void> {
    const link = this.#newLink(peerId);
    link.control = link.pc.createDataChannel(P2P_CONTROL_CHANNEL, { ordered: true });
    link.realtime = link.pc.createDataChannel(P2P_REALTIME_CHANNEL, { maxRetransmits: 0, ordered: false });
    this.#wireChannel(link, link.control);
    this.#wireChannel(link, link.realtime);
    const offer = await link.pc.createOffer();
    await link.pc.setLocalDescription(offer);
    await this.#api.sendSignal(this.roomId, peerId, this.#topologyEpoch, "offer", {
      sdp: offer.sdp ?? "",
      type: offer.type,
    });
  }

  #newLink(peerId: string): PeerLink {
    const pc = new RTCPeerConnection({ iceServers: [...this.#iceServers] });
    const link: PeerLink = { control: null, id: peerId, pc, pendingIce: [], realtime: null };
    this.#links.set(peerId, link);
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void this.#api.sendSignal(
        this.roomId,
        peerId,
        this.#topologyEpoch,
        "ice",
        event.candidate.toJSON() as unknown as Readonly<Record<string, unknown>>,
      )
        .catch(() => this.#emitStatus("ICE candidate exchange failed"));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        this.#emitStatus("Unable to establish a peer-to-peer connection. Your network or firewall may block direct multiplayer connections.");
      } else if (pc.connectionState === "closed") {
        this.#links.delete(peerId);
      } else {
        this.#emitStatus(null);
      }
    };
    pc.ondatachannel = (event) => {
      if (event.channel.label === P2P_CONTROL_CHANNEL) link.control = event.channel;
      else if (event.channel.label === P2P_REALTIME_CHANNEL) link.realtime = event.channel;
      else { event.channel.close(); return; }
      this.#wireChannel(link, event.channel);
    };
    return link;
  }

  #wireChannel(link: PeerLink, channel: RTCDataChannel): void {
    channel.onopen = () => {
      if (channel.label === P2P_CONTROL_CHANNEL && this.isHost) {
        channel.send(encodeP2PPacket({
          memberId: this.memberId,
          messageType: "peer.hello",
          protocolVersion: PROTOCOL_VERSION,
          roomId: this.roomId,
          topologyEpoch: this.#topologyEpoch,
        }));
      } else if (channel.label === P2P_REALTIME_CHANNEL && this.isHost && this.#authority) {
        const state = this.#authority.getSnapshot();
        channel.send(encodeP2PPacket({
          messageType: "game.snapshot",
          protocolVersion: PROTOCOL_VERSION,
          revision: state.revision,
          roomId: state.roomId,
          state,
        }));
      }
      this.#emitStatus(null);
    };
    channel.onmessage = (event) => {
      if (channel.label === P2P_CONTROL_CHANNEL) this.#handleControlPacket(link.id, event.data);
      else this.#handleRealtimePacket(link.id, event.data);
    };
  }

  #handleControlPacket(peerId: string, raw: unknown): void {
    const message = decodeP2PControlPacket(raw);
    if (!message) return;
    if (this.isHost) {
      if (message.messageType !== "game.command" || !this.#authority) return;
      try {
        const result = this.#authority.processCommand(peerId, message.command);
        this.#sendControl(peerId, { messageType: "game.command_result", protocolVersion: PROTOCOL_VERSION, result });
      } catch { /* malformed or unbound peer input is rejected */ }
      return;
    }
    if (peerId !== this.#hostMemberId || message.messageType === "game.command") return;
    for (const listener of this.#controlListeners) listener(message);
  }

  #handleRealtimePacket(peerId: string, raw: unknown): void {
    const message = decodeP2PRealtimePacket(raw);
    if (!message) return;
    if (this.isHost) {
      if (message.messageType !== "player.input" || !this.#authority) return;
      const { aimPitch, aimYaw, clientTimeMs, moveForward, moveRight } = message.payload;
      if (typeof aimPitch !== "number" || typeof aimYaw !== "number"
          || typeof clientTimeMs !== "number" || typeof moveForward !== "number"
          || typeof moveRight !== "number") return;
      try {
        this.#authority.processCommand(peerId, createCommandEnvelope({
          commandId: `${this.roomId}:input:${peerId}:${message.inputSequence}`,
          payload: {
            aimPitch,
            aimYaw,
            clientTimeMs,
            moveForward,
            moveRight,
            sequence: message.inputSequence,
            type: "combat.input",
          },
          roomId: this.roomId,
          sentAtMs: Date.now(),
        }));
      } catch { /* invalid, replayed, or unbound peer input is rejected */ }
      return;
    }
    if (peerId !== this.#hostMemberId || message.messageType !== "game.snapshot") return;
    for (const listener of this.#realtimeListeners) listener(message);
  }

  async #handleSignal(signal: P2PSignal): Promise<void> {
    if (signal.topologyEpoch !== this.#topologyEpoch) return;
    if (this.isHost) {
      const link = this.#links.get(signal.senderMemberId);
      if (!link) return;
      if (signal.type === "answer") {
        await link.pc.setRemoteDescription(signal.payload as unknown as RTCSessionDescriptionInit);
        await this.#flushIce(link);
      } else if (signal.type === "ice") {
        await this.#addIce(link, signal.payload);
      }
      return;
    }
    if (signal.senderMemberId !== this.#hostMemberId) return;
    let link = this.#links.get(signal.senderMemberId);
    if (signal.type === "offer") {
      if (!link) link = this.#newLink(signal.senderMemberId);
      await link.pc.setRemoteDescription(signal.payload as unknown as RTCSessionDescriptionInit);
      await this.#flushIce(link);
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      await this.#api.sendSignal(this.roomId, signal.senderMemberId, this.#topologyEpoch, "answer", {
        sdp: answer.sdp ?? "",
        type: answer.type,
      });
    } else if (signal.type === "ice") {
      if (!link) link = this.#newLink(signal.senderMemberId);
      await this.#addIce(link, signal.payload);
    }
  }

  async #addIce(link: PeerLink, candidate: RTCIceCandidateInit): Promise<void> {
    if (!link.pc.remoteDescription) { link.pendingIce.push(candidate); return; }
    await link.pc.addIceCandidate(candidate);
  }

  async #flushIce(link: PeerLink): Promise<void> {
    for (const candidate of link.pendingIce.splice(0)) await link.pc.addIceCandidate(candidate);
  }

  #sendControl(peerId: string, message: P2PControlMessage): void {
    const channel = this.#links.get(peerId)?.control;
    if (channel && channelOpen(channel)) channel.send(encodeP2PPacket(message));
  }

  #broadcastControl(message: P2PControlMessage): void {
    for (const link of this.#links.values()) if (channelOpen(link.control)) link.control.send(encodeP2PPacket(message));
  }

  #broadcastRealtime(message: P2PRealtimeMessage): void {
    for (const link of this.#links.values()) if (channelOpen(link.realtime)) link.realtime.send(encodeP2PPacket(message));
  }

  #scheduleCheckpoint(state: Readonly<GameState>): void {
    this.#latestCheckpointState = state;
    if (this.#checkpointTimer || this.#roomStatus !== "running") return;
    this.#checkpointTimer = setTimeout(() => {
      this.#checkpointTimer = null;
      const latestState = this.#latestCheckpointState;
      if (!latestState) return;
      const sequence = Number(latestState.revision);
      if (!this.#closed && this.isHost && Number.isSafeInteger(sequence) && sequence > 0) {
        void this.#api.saveCheckpoint(
          this.roomId,
          this.#topologyEpoch,
          sequence,
          latestState as unknown as Readonly<Record<string, unknown>>,
        )
          .catch(() => this.#emitStatus("Host checkpoint could not be saved"));
      }
    }, CHECKPOINT_INTERVAL_MS);
  }

  #syncSimulationLoop(): void {
    if (!this.isHost || this.#roomStatus !== "running" || !this.#authority) {
      this.#stopSimulationLoop();
      return;
    }
    if (this.#simulationTimer) return;
    this.#simulationTimer = setInterval(() => {
      if (this.#closed || !this.isHost || this.#roomStatus !== "running" || !this.#authority) {
        this.#stopSimulationLoop();
        return;
      }
      try { this.#authority.advanceSimulation(); }
      catch { this.#stopSimulationLoop(); }
    }, 1_000 / COMBAT_TICK_RATE);
  }

  #stopSimulationLoop(): void {
    if (!this.#simulationTimer) return;
    clearInterval(this.#simulationTimer);
    this.#simulationTimer = null;
  }

  #closeLinks(): void {
    for (const link of this.#links.values()) link.pc.close();
    this.#links.clear();
  }

  #status(error: string | null = null): StarNetworkStatus {
    const peers: Record<string, PeerConnectionState> = {};
    for (const [id, link] of this.#links) {
      const state = link.pc.connectionState;
      peers[id] = state === "connected" ? "connected"
        : state === "failed" ? "failed"
        : state === "disconnected" || state === "closed" ? "disconnected"
        : "connecting";
    }
    return {
      error,
      hostMemberId: this.#hostMemberId,
      isHost: this.isHost,
      members: this.#members,
      peers,
      roomStatus: this.#roomStatus,
      topologyEpoch: this.#topologyEpoch,
    };
  }

  #emitStatus(error: string | null): void {
    const status = this.#status(error);
    for (const listener of this.#statusListeners) listener(status);
  }
}
