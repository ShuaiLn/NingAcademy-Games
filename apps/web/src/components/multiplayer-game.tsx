"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Authority } from "@ningacademy/authority";
import type { GameState } from "@ningacademy/game-core";

import type { WebRtcStarNetwork, StarNetworkStatus } from "@/p2p/webrtc-star";
import type { P2PRoomJoin } from "@/server/p2p-types";

import { MultiplayerArena } from "./multiplayer-arena";

export interface MultiplayerGameProps {
  readonly join: P2PRoomJoin;
  readonly network: WebRtcStarNetwork;
  readonly networkStatus: StarNetworkStatus;
  readonly onLeave: () => Promise<void>;
}

const getServerSnapshot = (): null => null;

export function MultiplayerGame({
  join,
  network,
  networkStatus,
  onLeave,
}: MultiplayerGameProps): React.JSX.Element {
  const [authority, setAuthority] = useState<Authority | null>(null);
  const subscribe = useCallback(
    (notify: () => void) => network.subscribeGameState(() => notify()),
    [network],
  );
  const getSnapshot = useCallback((): Readonly<GameState> | null => network.getLatestGameState(), [network]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const nextAuthority = network.createAuthority();
    setAuthority(nextAuthority);
    return () => nextAuthority.close();
  }, [network]);

  if (authority === null || snapshot?.status !== "running" || snapshot.combat === null) {
    return (
      <section className="multiplayer-panel" aria-live="polite">
        Host 已启动房间，正在等待第一帧权威世界快照…
      </section>
    );
  }

  const localSurvivor = snapshot.combat.survivors[join.memberId] ?? null;
  const reloadTicks = localSurvivor?.rifle.reloadCompleteTick === null
    ? 0
    : Math.max(0, (localSurvivor?.rifle.reloadCompleteTick ?? 0) - snapshot.combat.tick);
  const wave = snapshot.combat.wave;
  const breakTicks = wave.breakEndsAtTick === null
    ? 0
    : Math.max(0, wave.breakEndsAtTick - snapshot.combat.tick);

  return (
    <section
      aria-labelledby="multiplayer-game-title"
      className="game-shell multiplayer-game-shell"
      data-enemy-count={Object.keys(snapshot.combat.enemies).length}
      data-game-revision={snapshot.revision}
      data-player-count={Object.keys(snapshot.combat.survivors).length}
      data-wave-number={wave.waveNumber}
      data-wave-phase={wave.phase}
    >
      <div className="multiplayer-game-heading">
        <div>
          <p className="eyebrow">ROOM {join.roomCode} // HOST-AUTHORITATIVE</p>
          <h2 id="multiplayer-game-title">多人实战</h2>
        </div>
        <div className="room-meta">
          <span>{Object.keys(snapshot.combat.survivors).length}/8 人</span>
          <span>{networkStatus.isHost ? "本机 Host" : "Peer"}</span>
          <span>拓扑 #{networkStatus.topologyEpoch}</span>
          <button onClick={() => void onLeave()} type="button">离开房间</button>
        </div>
      </div>

      <div className="combat-hud" aria-live="polite">
        <div>
          <span>生命 / HP</span>
          <strong className={(localSurvivor?.hp ?? 0) <= 25 ? "hud-danger" : ""}>
            {localSurvivor?.hp ?? 0}/{localSurvivor?.maxHp ?? 100}
          </strong>
        </div>
        <div>
          <span>弹药 / AMMO</span>
          <strong className={(localSurvivor?.rifle.ammo ?? 0) === 0 ? "hud-danger" : ""}>
            {reloadTicks > 0
              ? `换弹 ${(reloadTicks / 30).toFixed(1)}s`
              : `${localSurvivor?.rifle.ammo ?? 0}/${localSurvivor?.rifle.magazineSize ?? 12}`}
          </strong>
        </div>
        <div>
          <span>击杀 / KILLS</span>
          <strong>{localSurvivor?.kills ?? 0}</strong>
        </div>
        <div>
          <span>波次 / WAVE</span>
          <strong>
            {wave.waveNumber} · {wave.phase === "break" ? `休整 ${(breakTicks / 30).toFixed(1)}s` : wave.phase === "spawning" ? "生成中" : "战斗"}
          </strong>
        </div>
        <div>
          <span>剩余结晶体 / ENEMIES</span>
          <strong className={wave.enemiesRemaining === 0 ? "hud-danger" : ""}>
            {wave.enemiesRemaining}
          </strong>
        </div>
      </div>

      <MultiplayerArena
        authority={authority}
        localMemberId={join.memberId}
        network={network}
        snapshot={snapshot}
      />

      <div className="multiplayer-authority-note" role="status">
        <strong>HOST CONFIRMED</strong>
        <span>本地只预测移动；地图、Wave、生成、AI、命中、伤害、HP、弹药与重生均以 Host 快照和事件为准。</span>
        {networkStatus.error && <span className="network-error">{networkStatus.error}</span>}
      </div>
    </section>
  );
}
