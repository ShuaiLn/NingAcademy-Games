import type { SurvivorRoleId } from "../lib/role-gate";

export type PracticePhase =
  | "role_select"
  | "role_gate"
  | "playing"
  | "card_pick"
  | "card_question"
  | "card_feedback";

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export interface PracticePlayerState {
  readonly alive: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly position: Vec2;
  readonly respawnRemainingMs: number;
}

export interface PracticeWeaponState {
  readonly ammo: number;
  readonly damage: number;
  readonly fireCooldownMs: number;
  readonly magazineSize: number;
  readonly reloadRemainingMs: number;
}

export interface PracticeEnemyState {
  readonly alive: boolean;
  readonly attackCooldownMs: number;
  readonly hp: number;
  readonly id: string;
  readonly maxHp: number;
  readonly position: Vec2;
  readonly respawnRemainingMs: number;
}

export interface PublicPracticeQuestion {
  readonly id: string;
  readonly prompt: string;
  readonly promptLanguage: "en" | "zh" | "math";
  readonly security: "local_mock_answer_embedded_in_client";
  readonly sourceLabel: "UNVERIFIED LOCAL MOCK";
}

export interface PracticeQuestionFeedback {
  readonly correct: boolean;
  readonly correctAnswer: string;
  readonly explanation: string;
  readonly timedOut: boolean;
}

export interface RoleGateState {
  readonly attemptIndex: number;
  readonly correctCount: number;
  readonly feedback: PracticeQuestionFeedback | null;
  readonly question: PublicPracticeQuestion;
  readonly requiredCorrect: number;
  readonly roleId: SurvivorRoleId;
}

export type PracticeCardId = "calibrated_rounds" | "extended_mag" | "crystal_plating";

export interface PracticeCard {
  readonly description: string;
  readonly id: PracticeCardId;
  readonly name: string;
}

export interface CardQuestionState {
  readonly feedback: PracticeQuestionFeedback | null;
  readonly question: PublicPracticeQuestion;
  readonly remainingMs: number;
}

export interface PracticeState {
  readonly cardChoices: readonly PracticeCard[];
  readonly cardOpportunityUsed: boolean;
  readonly cardQuestion: CardQuestionState | null;
  readonly elapsedMs: number;
  readonly enemy: PracticeEnemyState;
  readonly kills: number;
  readonly pendingCardId: PracticeCardId | null;
  readonly phase: PracticePhase;
  readonly player: PracticePlayerState;
  readonly roleGate: RoleGateState | null;
  readonly selectedRoleId: SurvivorRoleId | null;
  readonly verification: "unverified_local";
  readonly weapon: PracticeWeaponState;
}

export interface PracticeMovementInput {
  readonly forward: number;
  readonly right: number;
  readonly yaw: number;
}

export type PracticeCommand =
  | { readonly type: "role.select"; readonly roleId: SurvivorRoleId }
  | { readonly type: "answer.submit"; readonly answer: string }
  | { readonly type: "feedback.continue" }
  | { readonly type: "simulation.step"; readonly deltaMs: number; readonly input: PracticeMovementInput }
  | { readonly type: "weapon.fire"; readonly pitch: number; readonly yaw: number }
  | { readonly type: "weapon.reload" }
  | { readonly type: "card.select"; readonly cardId: PracticeCardId };

export type PracticeEvent =
  | { readonly type: "shot.fired"; readonly hit: boolean }
  | { readonly type: "enemy.damaged"; readonly hp: number }
  | { readonly type: "enemy.killed"; readonly position: Vec2 }
  | { readonly type: "enemy.respawned"; readonly position: Vec2 }
  | { readonly type: "player.damaged"; readonly amount: number; readonly trueDamage: boolean }
  | { readonly type: "player.died" }
  | { readonly type: "player.respawned" }
  | { readonly type: "card.applied"; readonly cardId: PracticeCardId };

export interface PracticeReduction {
  readonly events: readonly PracticeEvent[];
  readonly state: PracticeState;
}

export type PracticeUpdate = PracticeReduction;

export type PracticeListener = (update: PracticeUpdate) => void;

/**
 * Both local and future remote adapters expose the same client surface. A
 * verified remote implementation must receive identity and judged answers
 * from its authenticated transport; callers never pass a user id here.
 */
export interface PracticeAuthority {
  readonly verification: "unverified_local" | "verified_remote";
  dispatch(command: PracticeCommand): PracticeUpdate;
  getSnapshot(): Readonly<PracticeState>;
  subscribe(listener: PracticeListener): () => void;
}

/** Deliberately unimplemented P0 seam for the authenticated production adapter. */
export interface VerifiedRemoteAuthorityConnector {
  readonly requiresOpaqueMainSiteSession: true;
  connect(): Promise<PracticeAuthority>;
}
