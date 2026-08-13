"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  DEFAULT_EFFECTS_PREFERENCES,
  resolveEffectsPreferences,
  type ShardMode,
} from "@/lib/effects-preferences";
import type { FlashMode } from "@/lib/flash-governor";
import { survivorRoles } from "@/lib/role-gate";
import { LOCAL_MOCK_SECURITY_NOTICE } from "@/practice/local-mock-questions";
import { LocalPracticeAuthority } from "@/practice/local-practice-authority";

import { PracticeArena } from "./practice-arena";
import { PracticeQuestionOverlay } from "./practice-question-overlay";
import { RoleSelection } from "./role-selection";

export function GameCanvas(): React.JSX.Element {
  const [authority] = useState(() => new LocalPracticeAuthority());
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [manualReducedMotion, setManualReducedMotion] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>("normal");
  const [shardMode, setShardMode] = useState<ShardMode>("normal");

  const subscribe = useCallback(
    (notify: () => void) => authority.subscribe(() => notify()),
    [authority],
  );
  const getSnapshot = useCallback(() => authority.getSnapshot(), [authority]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => setSystemReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (state.phase !== "playing" && document.pointerLockElement !== null) {
      document.exitPointerLock();
    }
  }, [state.phase]);

  const effects = useMemo(
    () => resolveEffectsPreferences(
      { ...DEFAULT_EFFECTS_PREFERENCES, flashMode, shardMode },
      undefined,
      systemReducedMotion || manualReducedMotion,
    ),
    [flashMode, manualReducedMotion, shardMode, systemReducedMotion],
  );
  const selectedRole = survivorRoles.find((role) => role.id === state.selectedRoleId);

  if (state.phase === "role_select") {
    return (
      <section className="game-shell practice-shell">
        <div className="practice-warning" role="status">
          <strong>UNVERIFIED LocalAuthority</strong>
          <span>完全本地练习；不进入作业、学习记录或个人段位。</span>
        </div>
        <RoleSelection onSelect={(roleId) => authority.dispatch({ type: "role.select", roleId })} />
      </section>
    );
  }

  if (state.phase === "role_gate" && state.roleGate !== null) {
    return (
      <section className="game-shell practice-shell role-gate-shell">
        <div className="practice-warning" role="status">
          <strong>UNVERIFIED LOCAL MOCK</strong>
          <span>无时限职业门题；答题时不使用 Pointer Lock。</span>
        </div>
        <PracticeQuestionOverlay
          feedback={state.roleGate.feedback}
          onContinue={() => authority.dispatch({ type: "feedback.continue" })}
          onSubmit={(answer) => authority.dispatch({ type: "answer.submit", answer })}
          progressLabel={`${state.roleGate.correctCount}/${state.roleGate.requiredCorrect} 正确`}
          question={state.roleGate.question}
          title="职业解锁模拟题 / Role gate"
        />
      </section>
    );
  }

  return (
    <section aria-labelledby="practice-title" className="game-shell practice-shell">
      <div className="practice-warning" role="status">
        <strong>UNVERIFIED LocalAuthority</strong>
        <span>本地成绩不保存、不进入作业、不改变个人段位；无 Supabase 或 Colyseus 连接。</span>
      </div>

      <div className="combat-hud" aria-live="polite">
        <div>
          <span>职业 / ROLE</span>
          <strong>{selectedRole?.nameZh ?? "—"} <small>{selectedRole?.nameEn}</small></strong>
        </div>
        <div>
          <span>生命 / HP</span>
          <strong className={state.player.hp <= 25 ? "hud-danger" : ""}>
            {state.player.hp}/{state.player.maxHp}
          </strong>
        </div>
        <div>
          <span>弹药 / AMMO</span>
          <strong className={state.weapon.ammo === 0 ? "hud-danger" : ""}>
            {state.weapon.reloadRemainingMs > 0
              ? `换弹 ${(state.weapon.reloadRemainingMs / 1_000).toFixed(1)}s`
              : `${state.weapon.ammo}/${state.weapon.magazineSize}`}
          </strong>
        </div>
        <div>
          <span>击杀 / KILLS</span>
          <strong>{state.kills}<small>/ 10 触发选卡</small></strong>
        </div>
      </div>

      <PracticeArena authority={authority} effects={effects} state={state} />

      <div className="effects-toolbar" aria-label="视觉安全设置 / visual safety settings">
        <label>
          <input
            checked={manualReducedMotion}
            onChange={(event) => setManualReducedMotion(event.currentTarget.checked)}
            type="checkbox"
          />
          减少动态效果 / Reduced motion
        </label>
        <label>
          闪光
          <select
            disabled={systemReducedMotion || manualReducedMotion}
            onChange={(event) => setFlashMode(event.currentTarget.value as FlashMode)}
            value={effects.flashMode}
          >
            <option value="normal">标准</option>
            <option value="reduced">降低</option>
            <option value="off">关闭</option>
          </select>
        </label>
        <label>
          碎片
          <select
            disabled={systemReducedMotion || manualReducedMotion}
            onChange={(event) => setShardMode(event.currentTarget.value as ShardMode)}
            value={effects.shardMode}
          >
            <option value="normal">标准</option>
            <option value="reduced">降低</option>
            <option value="off">关闭</option>
          </select>
        </label>
        <span>{systemReducedMotion ? "已遵循系统 reduced-motion" : "击杀闪光经 FlashGovernor 限流"}</span>
      </div>

      {state.phase === "card_pick" && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="card-pick-title" aria-modal="true" className="card-panel" role="dialog">
            <p className="eyebrow">KILL 10 // LOCAL SIMULATION PAUSED</p>
            <h2 id="card-pick-title">选择一张卡，再完成限时题</h2>
            <p>选卡期间本地战斗完全暂停，Pointer Lock 已释放。</p>
            <div className="card-grid">
              {state.cardChoices.map((card) => (
                <button
                  key={card.id}
                  onClick={() => authority.dispatch({ type: "card.select", cardId: card.id })}
                  type="button"
                >
                  <strong>{card.name}</strong>
                  <span>{card.description}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {(state.phase === "card_question" || state.phase === "card_feedback") && state.cardQuestion !== null && (
        <PracticeQuestionOverlay
          feedback={state.cardQuestion.feedback}
          onContinue={() => authority.dispatch({ type: "feedback.continue" })}
          onSubmit={(answer) => authority.dispatch({ type: "answer.submit", answer })}
          progressLabel="CARD QUESTION // 1 OF 1"
          question={state.cardQuestion.question}
          remainingMs={state.cardQuestion.remainingMs}
          title="卡牌限时题 / Timed card question"
        />
      )}

      <p className="mock-security-footnote">{LOCAL_MOCK_SECURITY_NOTICE}</p>
    </section>
  );
}
