import { getRoleGateRequirement, type SurvivorRoleId } from "../lib/role-gate";

import {
  LOCAL_CARD_QUESTION,
  LOCAL_ROLE_GATE_QUESTIONS,
  judgeLocalMockQuestion,
} from "./local-mock-questions";
import type {
  PracticeAuthority,
  PracticeCard,
  PracticeCardId,
  PracticeCommand,
  PracticeEvent,
  PracticeListener,
  PracticePlayerState,
  PracticeReduction,
  PracticeState,
  PracticeWeaponState,
  Vec2,
} from "./types";

const PLAYER_EYE_HEIGHT = 1.6;
const ENEMY_CORE_HEIGHT = 1.1;
const ENEMY_HIT_RADIUS = 0.85;
const MAX_HIT_RANGE = 28;
const CARD_QUESTION_TIME_MS = 15_000;

export const PRACTICE_CARDS = [
  {
    id: "calibrated_rounds",
    name: "校准弹药 / Calibrated Rounds",
    description: "每发伤害 +10 / +10 damage per shot",
  },
  {
    id: "extended_mag",
    name: "扩容弹匣 / Extended Magazine",
    description: "弹匣容量 +6 并装满 / +6 magazine and refill",
  },
  {
    id: "crystal_plating",
    name: "晶体护层 / Crystal Plating",
    description: "最大生命 +15 并治疗 / +15 max HP and heal",
  },
] as const satisfies readonly PracticeCard[];

function roleQuestion(attemptIndex: number) {
  const mock = LOCAL_ROLE_GATE_QUESTIONS[attemptIndex % LOCAL_ROLE_GATE_QUESTIONS.length];
  if (mock === undefined) {
    throw new Error("Local role question bank must not be empty");
  }
  return mock;
}

const initialPlayer: PracticePlayerState = {
  alive: true,
  hp: 100,
  maxHp: 100,
  position: { x: 0, z: 0 },
  respawnRemainingMs: 0,
};

const initialWeapon: PracticeWeaponState = {
  ammo: 12,
  damage: 50,
  fireCooldownMs: 0,
  magazineSize: 12,
  reloadRemainingMs: 0,
};

export function createInitialPracticeState(): PracticeState {
  return {
    cardChoices: PRACTICE_CARDS,
    cardOpportunityUsed: false,
    cardQuestion: null,
    elapsedMs: 0,
    enemy: {
      alive: true,
      attackCooldownMs: 0,
      hp: 100,
      id: "local-thrall-1",
      maxHp: 100,
      position: { x: 0, z: 8 },
      respawnRemainingMs: 0,
    },
    kills: 0,
    pendingCardId: null,
    phase: "role_select",
    player: initialPlayer,
    roleGate: null,
    selectedRoleId: null,
    verification: "unverified_local",
    weapon: initialWeapon,
  };
}

function roleStats(roleId: SurvivorRoleId): {
  readonly player: PracticePlayerState;
  readonly weapon: PracticeWeaponState;
} {
  const roleModifiers: Readonly<Record<SurvivorRoleId, { hp: number; damage: number; magazine: number }>> = {
    assassin: { hp: 95, damage: 53, magazine: 12 },
    guardian: { hp: 110, damage: 46, magazine: 12 },
    mage: { hp: 95, damage: 51, magazine: 12 },
    medic: { hp: 100, damage: 48, magazine: 12 },
    warrior: { hp: 105, damage: 50, magazine: 12 },
  };
  const modifier = roleModifiers[roleId];

  return {
    player: { ...initialPlayer, hp: modifier.hp, maxHp: modifier.hp },
    weapon: {
      ...initialWeapon,
      ammo: modifier.magazine,
      damage: modifier.damage,
      magazineSize: modifier.magazine,
    },
  };
}

function beginRole(state: PracticeState, roleId: SurvivorRoleId): PracticeState {
  const stats = roleStats(roleId);
  return {
    ...state,
    phase: "playing",
    player: stats.player,
    roleGate: null,
    selectedRoleId: roleId,
    weapon: stats.weapon,
  };
}

function selectRole(state: PracticeState, roleId: SurvivorRoleId): PracticeReduction {
  if (state.phase !== "role_select") {
    return { state, events: [] };
  }

  const requirement = getRoleGateRequirement(roleId, new Set());
  if (requirement.questionCount === 0) {
    return { state: beginRole(state, roleId), events: [] };
  }

  return {
    events: [],
    state: {
      ...state,
      phase: "role_gate",
      roleGate: {
        attemptIndex: 0,
        correctCount: 0,
        feedback: null,
        question: roleQuestion(0).publicQuestion,
        questionCount: requirement.questionCount,
        requiredCorrect: Math.ceil(
          requirement.questionCount * requirement.minimumFirstAttemptAccuracy,
        ),
        roleId,
      },
    },
  };
}

function submitAnswer(state: PracticeState, answer: string): PracticeReduction {
  const roleGate = state.roleGate;
  if (state.phase === "role_gate" && roleGate !== null && roleGate.feedback === null) {
    const mock = roleQuestion(roleGate.attemptIndex);
    const feedback = judgeLocalMockQuestion(mock, answer);
    return {
      events: [],
      state: {
        ...state,
        roleGate: {
          ...roleGate,
          correctCount: roleGate.correctCount + (feedback.correct ? 1 : 0),
          feedback,
        },
      },
    };
  }

  if (state.phase === "card_question" && state.cardQuestion?.feedback === null) {
    return judgeCardAnswer(state, answer, false);
  }

  return { state, events: [] };
}

function continueFeedback(state: PracticeState): PracticeReduction {
  const roleGate = state.roleGate;
  if (state.phase === "role_gate" && roleGate !== null && roleGate.feedback !== null) {
    const answeredCount = roleGate.attemptIndex + 1;
    if (answeredCount >= roleGate.questionCount) {
      if (roleGate.correctCount >= roleGate.requiredCorrect) {
        return { state: beginRole(state, roleGate.roleId), events: [] };
      }

      return {
        events: [],
        state: {
          ...state,
          roleGate: {
            ...roleGate,
            attemptIndex: 0,
            correctCount: 0,
            feedback: null,
            question: roleQuestion(0).publicQuestion,
          },
        },
      };
    }

    const nextAttempt = roleGate.attemptIndex + 1;
    return {
      events: [],
      state: {
        ...state,
        roleGate: {
          ...roleGate,
          attemptIndex: nextAttempt,
          feedback: null,
          question: roleQuestion(nextAttempt).publicQuestion,
        },
      },
    };
  }

  if (state.phase === "card_feedback" && state.cardQuestion?.feedback !== null) {
    return {
      events: [],
      state: {
        ...state,
        cardQuestion: null,
        enemy: { ...state.enemy, respawnRemainingMs: 300 },
        pendingCardId: null,
        phase: "playing",
      },
    };
  }

  return { state, events: [] };
}

function selectCard(state: PracticeState, cardId: PracticeCardId): PracticeReduction {
  if (state.phase !== "card_pick" || !state.cardChoices.some((card) => card.id === cardId)) {
    return { state, events: [] };
  }

  return {
    events: [],
    state: {
      ...state,
      cardQuestion: {
        feedback: null,
        question: LOCAL_CARD_QUESTION.publicQuestion,
        remainingMs: CARD_QUESTION_TIME_MS,
      },
      pendingCardId: cardId,
      phase: "card_question",
    },
  };
}

function applyCard(
  player: PracticePlayerState,
  weapon: PracticeWeaponState,
  cardId: PracticeCardId,
): { readonly player: PracticePlayerState; readonly weapon: PracticeWeaponState } {
  switch (cardId) {
    case "calibrated_rounds":
      return { player, weapon: { ...weapon, damage: weapon.damage + 10 } };
    case "extended_mag": {
      const magazineSize = weapon.magazineSize + 6;
      return { player, weapon: { ...weapon, ammo: magazineSize, magazineSize } };
    }
    case "crystal_plating": {
      const maxHp = player.maxHp + 15;
      return { player: { ...player, hp: Math.min(maxHp, player.hp + 15), maxHp }, weapon };
    }
    default: {
      const exhaustiveCard: never = cardId;
      return exhaustiveCard;
    }
  }
}

function judgeCardAnswer(state: PracticeState, answer: string, timedOut: boolean): PracticeReduction {
  if (state.cardQuestion === null || state.pendingCardId === null) {
    return { state, events: [] };
  }

  const feedback = judgeLocalMockQuestion(LOCAL_CARD_QUESTION, answer, timedOut);
  if (feedback.correct) {
    const applied = applyCard(state.player, state.weapon, state.pendingCardId);
    return {
      events: [{ type: "card.applied", cardId: state.pendingCardId }],
      state: {
        ...state,
        cardOpportunityUsed: true,
        cardQuestion: { ...state.cardQuestion, feedback },
        phase: "card_feedback",
        player: applied.player,
        weapon: applied.weapon,
      },
    };
  }

  const hp = Math.max(1, state.player.hp - 10);
  return {
    events: [{ type: "player.damaged", amount: state.player.hp - hp, trueDamage: true }],
    state: {
      ...state,
      cardOpportunityUsed: true,
      cardQuestion: { ...state.cardQuestion, feedback },
      phase: "card_feedback",
      player: { ...state.player, hp },
    },
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function respawnPosition(kills: number): Vec2 {
  const angle = (kills * 2.399_963_229_728_653) % (Math.PI * 2);
  return { x: Math.sin(angle) * 7, z: Math.cos(angle) * 7 };
}

function stepSimulation(state: PracticeState, deltaMs: number, input: { forward: number; right: number; yaw: number }): PracticeReduction {
  const boundedDeltaMs = clamp(Number.isFinite(deltaMs) ? deltaMs : 0, 0, 50);
  const elapsedMs = state.elapsedMs + boundedDeltaMs;

  if (state.phase === "card_question" && state.cardQuestion?.feedback === null) {
    const remainingMs = Math.max(0, state.cardQuestion.remainingMs - boundedDeltaMs);
    if (remainingMs === 0) {
      return judgeCardAnswer(
        { ...state, elapsedMs, cardQuestion: { ...state.cardQuestion, remainingMs } },
        "",
        true,
      );
    }
    return {
      events: [],
      state: { ...state, elapsedMs, cardQuestion: { ...state.cardQuestion, remainingMs } },
    };
  }

  if (state.phase !== "playing") {
    return { events: [], state: { ...state, elapsedMs } };
  }

  const events: PracticeEvent[] = [];
  const seconds = boundedDeltaMs / 1_000;
  let weapon: PracticeWeaponState = {
    ...state.weapon,
    fireCooldownMs: Math.max(0, state.weapon.fireCooldownMs - boundedDeltaMs),
    reloadRemainingMs: Math.max(0, state.weapon.reloadRemainingMs - boundedDeltaMs),
  };
  if (state.weapon.reloadRemainingMs > 0 && weapon.reloadRemainingMs === 0) {
    weapon = { ...weapon, ammo: weapon.magazineSize };
  }

  let player = state.player;
  let enemy = state.enemy;

  if (!player.alive) {
    const respawnRemainingMs = Math.max(0, player.respawnRemainingMs - boundedDeltaMs);
    if (respawnRemainingMs === 0) {
      player = {
        ...player,
        alive: true,
        hp: player.maxHp,
        position: { x: 0, z: 0 },
        respawnRemainingMs: 0,
      };
      events.push({ type: "player.respawned" });
    } else {
      player = { ...player, respawnRemainingMs };
    }
  } else {
    const forward = clamp(input.forward, -1, 1);
    const right = clamp(input.right, -1, 1);
    const magnitude = Math.hypot(forward, right) || 1;
    const speed = 4.5 * seconds;
    const normalizedForward = forward / magnitude;
    const normalizedRight = right / magnitude;
    const deltaX = (
      Math.sin(input.yaw) * normalizedForward + Math.cos(input.yaw) * normalizedRight
    ) * speed;
    const deltaZ = (
      Math.cos(input.yaw) * normalizedForward - Math.sin(input.yaw) * normalizedRight
    ) * speed;
    player = {
      ...player,
      position: {
        x: clamp(player.position.x + deltaX, -13, 13),
        z: clamp(player.position.z + deltaZ, -13, 13),
      },
    };
  }

  if (!enemy.alive) {
    const respawnRemainingMs = Math.max(0, enemy.respawnRemainingMs - boundedDeltaMs);
    if (respawnRemainingMs === 0) {
      const position = respawnPosition(state.kills);
      enemy = {
        ...enemy,
        alive: true,
        attackCooldownMs: 700,
        hp: enemy.maxHp,
        position,
        respawnRemainingMs: 0,
      };
      events.push({ type: "enemy.respawned", position });
    } else {
      enemy = { ...enemy, respawnRemainingMs };
    }
  } else if (player.alive) {
    const offsetX = player.position.x - enemy.position.x;
    const offsetZ = player.position.z - enemy.position.z;
    const distance = Math.hypot(offsetX, offsetZ);
    const attackCooldownMs = Math.max(0, enemy.attackCooldownMs - boundedDeltaMs);

    if (distance > 1.35) {
      const step = Math.min(distance - 1.35, 1.55 * seconds);
      enemy = {
        ...enemy,
        attackCooldownMs,
        position: {
          x: enemy.position.x + (offsetX / distance) * step,
          z: enemy.position.z + (offsetZ / distance) * step,
        },
      };
    } else if (attackCooldownMs === 0) {
      const hp = Math.max(0, player.hp - 8);
      player = { ...player, alive: hp > 0, hp, respawnRemainingMs: hp > 0 ? 0 : 2_000 };
      enemy = { ...enemy, attackCooldownMs: 750 };
      events.push({ type: "player.damaged", amount: 8, trueDamage: false });
      if (hp === 0) {
        events.push({ type: "player.died" });
      }
    } else {
      enemy = { ...enemy, attackCooldownMs };
    }
  }

  return { events, state: { ...state, elapsedMs, enemy, player, weapon } };
}

function rayHitsEnemy(state: PracticeState, yaw: number, pitch: number): boolean {
  const direction = {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
  const toCore = {
    x: state.enemy.position.x - state.player.position.x,
    y: ENEMY_CORE_HEIGHT - PLAYER_EYE_HEIGHT,
    z: state.enemy.position.z - state.player.position.z,
  };
  const projection = toCore.x * direction.x + toCore.y * direction.y + toCore.z * direction.z;
  if (projection < 0 || projection > MAX_HIT_RANGE) {
    return false;
  }
  const distanceSquared = toCore.x ** 2 + toCore.y ** 2 + toCore.z ** 2 - projection ** 2;
  return distanceSquared <= ENEMY_HIT_RADIUS ** 2;
}

function fireWeapon(state: PracticeState, yaw: number, pitch: number): PracticeReduction {
  if (
    state.phase !== "playing" ||
    !state.player.alive ||
    state.weapon.ammo <= 0 ||
    state.weapon.fireCooldownMs > 0 ||
    state.weapon.reloadRemainingMs > 0
  ) {
    return { state, events: [] };
  }

  const weapon = { ...state.weapon, ammo: state.weapon.ammo - 1, fireCooldownMs: 180 };
  const hit = state.enemy.alive && rayHitsEnemy(state, yaw, pitch);
  const events: PracticeEvent[] = [{ type: "shot.fired", hit }];
  if (!hit) {
    return { events, state: { ...state, weapon } };
  }

  const hp = Math.max(0, state.enemy.hp - weapon.damage);
  events.push({ type: "enemy.damaged", hp });
  if (hp > 0) {
    return { events, state: { ...state, enemy: { ...state.enemy, hp }, weapon } };
  }

  const kills = state.kills + 1;
  events.push({ type: "enemy.killed", position: state.enemy.position });
  const cardOpportunity = kills === 10 && !state.cardOpportunityUsed;
  return {
    events,
    state: {
      ...state,
      enemy: { ...state.enemy, alive: false, hp: 0, respawnRemainingMs: 900 },
      kills,
      phase: cardOpportunity ? "card_pick" : state.phase,
      weapon,
    },
  };
}

function reloadWeapon(state: PracticeState): PracticeReduction {
  if (
    state.phase !== "playing" ||
    state.weapon.reloadRemainingMs > 0 ||
    state.weapon.ammo === state.weapon.magazineSize
  ) {
    return { state, events: [] };
  }
  return { events: [], state: { ...state, weapon: { ...state.weapon, reloadRemainingMs: 800 } } };
}

export function reducePracticeCommand(
  state: PracticeState,
  command: PracticeCommand,
): PracticeReduction {
  switch (command.type) {
    case "role.select":
      return selectRole(state, command.roleId);
    case "answer.submit":
      return submitAnswer(state, command.answer);
    case "feedback.continue":
      return continueFeedback(state);
    case "card.select":
      return selectCard(state, command.cardId);
    case "simulation.step":
      return stepSimulation(state, command.deltaMs, command.input);
    case "weapon.fire":
      return fireWeapon(state, command.yaw, command.pitch);
    case "weapon.reload":
      return reloadWeapon(state);
    default: {
      const exhaustiveCommand: never = command;
      return exhaustiveCommand;
    }
  }
}

export class LocalPracticeAuthority implements PracticeAuthority {
  readonly verification = "unverified_local" as const;

  readonly #listeners = new Set<PracticeListener>();
  #state: PracticeState;

  constructor(initialState: PracticeState = createInitialPracticeState()) {
    this.#state = initialState;
  }

  dispatch(command: PracticeCommand): PracticeReduction {
    const update = reducePracticeCommand(this.#state, command);
    this.#state = update.state;
    for (const listener of this.#listeners) {
      listener(update);
    }
    return update;
  }

  getSnapshot(): Readonly<PracticeState> {
    return this.#state;
  }

  subscribe(listener: PracticeListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}
