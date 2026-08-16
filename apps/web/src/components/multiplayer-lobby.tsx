"use client";

import { useEffect, useRef, useState } from "react";

import { P2PApiClient, P2PApiError, type SessionStatus } from "@/p2p/p2p-api-client";
import { WebRtcStarNetwork, type StarNetworkStatus } from "@/p2p/webrtc-star";
import type { P2PRoomJoin } from "@/server/p2p-types";

type PortalState =
  | { readonly kind: "checking" }
  | { readonly kind: "locked" }
  | { readonly kind: "menu"; readonly session: SessionStatus }
  | { readonly kind: "connecting"; readonly session: SessionStatus }
  | {
      readonly join: P2PRoomJoin;
      readonly kind: "room";
      readonly network: StarNetworkStatus;
      readonly session: SessionStatus;
    }
  | { readonly kind: "failed"; readonly message: string; readonly session: SessionStatus | null };

function readableError(error: unknown): string {
  if (error instanceof P2PApiError) {
    if (error.message === "full") return "房间已满（最多 8 人）。";
    if (error.status === 401) return "Games session 已失效，请从主站重新进入。";
    if (error.message === "invalid") return "房间不存在、已过期，或不属于当前作业。";
  }
  return error instanceof Error ? error.message : "多人连接暂时不可用。";
}

export function MultiplayerLobby(): React.JSX.Element {
  const apiRef = useRef(new P2PApiClient());
  const networkRef = useRef<WebRtcStarNetwork | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [state, setState] = useState<PortalState>({ kind: "checking" });

  useEffect(() => {
    const api = apiRef.current;
    let cancelled = false;
    api.session()
      .then((session) => { if (!cancelled) setState({ kind: "menu", session }); })
      .catch((error) => {
        if (cancelled) return;
        setState(error instanceof P2PApiError && error.status === 401
          ? { kind: "locked" }
          : { kind: "failed", message: readableError(error), session: null });
      });
    return () => {
      cancelled = true;
      void networkRef.current?.close(false);
    };
  }, []);

  async function enterRoom(session: SessionStatus, join: P2PRoomJoin): Promise<void> {
    setState({ kind: "connecting", session });
    try {
      const { iceServers } = await apiRef.current.iceConfig();
      const network = new WebRtcStarNetwork({ api: apiRef.current, iceServers, room: join });
      networkRef.current = network;
      network.subscribeStatus((networkStatus) => {
        setState({ join, kind: "room", network: networkStatus, session });
      });
      await network.start();
    } catch (error) {
      setState({ kind: "failed", message: readableError(error), session });
    }
  }

  async function createRoom(session: SessionStatus): Promise<void> {
    setState({ kind: "connecting", session });
    try { await enterRoom(session, await apiRef.current.createRoom(8)); }
    catch (error) { setState({ kind: "failed", message: readableError(error), session }); }
  }

  async function joinRoom(session: SessionStatus): Promise<void> {
    const code = roomCode.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      setState({ kind: "failed", message: "请输入 6 位房间码（不含 0、1、I、O）。", session });
      return;
    }
    setState({ kind: "connecting", session });
    try { await enterRoom(session, await apiRef.current.joinRoom(code)); }
    catch (error) { setState({ kind: "failed", message: readableError(error), session }); }
  }

  async function leaveRoom(session: SessionStatus): Promise<void> {
    const network = networkRef.current;
    networkRef.current = null;
    await network?.close(true);
    setState({ kind: "menu", session });
  }

  if (state.kind === "checking" || state.kind === "connecting") {
    return <section className="multiplayer-panel" aria-live="polite">正在验证 Games session 与 P2P 房间状态…</section>;
  }
  if (state.kind === "locked") {
    return (
      <section className="multiplayer-panel">
        <p className="eyebrow">MULTIPLAYER LOCKED</p>
        <h2>请从 NingAcademy 作业页进入</h2>
        <p>多人模式只接受主站签发的一次性票据所建立的 HttpOnly Games session，不提供第二套登录。</p>
      </section>
    );
  }
  if (state.kind === "failed") {
    return (
      <section className="multiplayer-panel error-panel" role="alert">
        <p>{state.message}</p>
        <button onClick={() => setState(state.session ? { kind: "menu", session: state.session } : { kind: "checking" })} type="button">
          返回重试
        </button>
      </section>
    );
  }
  if (state.kind === "menu") {
    return (
      <section className="multiplayer-panel" aria-labelledby="multiplayer-title">
        <p className="eyebrow">HOST-AUTHORITATIVE WEBRTC // 2–8 PLAYERS</p>
        <h2 id="multiplayer-title">多人游戏</h2>
        <p>{state.session.displayName}，创建房间后你的浏览器将成为 Host；加入者只向 Host 发送输入。</p>
        <div className="multiplayer-actions">
          <button onClick={() => void createRoom(state.session)} type="button">创建游戏</button>
          <form onSubmit={(event) => { event.preventDefault(); void joinRoom(state.session); }}>
            <label htmlFor="room-code">房间码</label>
            <input
              autoComplete="off"
              id="room-code"
              inputMode="text"
              maxLength={6}
              onChange={(event) => setRoomCode(event.currentTarget.value.toUpperCase())}
              placeholder="N7K4PQ"
              value={roomCode}
            />
            <button type="submit">加入游戏</button>
          </form>
        </div>
        <p className="network-note">使用 STUN 建立浏览器直连；TURN 为可选配置。严格 NAT 或学校防火墙可能阻止第一版直连。</p>
      </section>
    );
  }

  const me = state.network.members.find((member) => member.memberId === state.join.memberId);
  const connectedMembers = state.network.members.filter((member) => member.connected);
  const allReady = connectedMembers.length >= 2 && connectedMembers.every((member) => member.ready);
  return (
    <section className="multiplayer-panel room-panel" aria-labelledby="room-title">
      <div className="room-heading">
        <div>
          <p className="eyebrow">ROOM CODE</p>
          <h2 id="room-title">{state.join.roomCode}</h2>
        </div>
        <div className="room-meta">
          <span>{state.network.members.length}/8 人</span>
          <span>{state.network.isHost ? "你是 Host" : "Peer"}</span>
          <span>拓扑 #{state.network.topologyEpoch}</span>
        </div>
      </div>

      <ul className="member-list">
        {state.network.members.map((member) => (
          <li key={member.memberId}>
            <span className={`status-dot ${member.connected ? "status-ready" : "status-failed"}`} />
            <strong>{member.displayName}</strong>
            {member.memberId === state.network.hostMemberId && <span>HOST</span>}
            <span>{member.ready ? "已准备" : "未准备"}</span>
            <span>{state.network.peers[member.memberId] ?? (member.memberId === state.join.memberId ? "本机" : "等待 P2P")}</span>
          </li>
        ))}
      </ul>

      {state.network.error && <p className="network-error" role="alert">{state.network.error}</p>}
      <div className="room-buttons">
        {state.network.roomStatus === "lobby" && (
          <button onClick={() => void apiRef.current.setReady(state.join.roomId, !me?.ready)} type="button">
            {me?.ready ? "取消准备" : "准备"}
          </button>
        )}
        {state.network.isHost && state.network.roomStatus === "lobby" && (
          <button disabled={!allReady} onClick={() => void apiRef.current.startRoom(state.join.roomId)} type="button">
            开始游戏
          </button>
        )}
        <button onClick={() => void leaveRoom(state.session)} type="button">离开房间</button>
      </div>
      <p className="network-note">
        {state.network.roomStatus === "running"
          ? "Host 正在运行世界、敌人、伤害与结果模拟；其他玩家只能发送输入/意图。"
          : "Host 断线后将按加入顺序选举新 Host，并从最近 checkpoint 重建星型连接。"}
      </p>
    </section>
  );
}
