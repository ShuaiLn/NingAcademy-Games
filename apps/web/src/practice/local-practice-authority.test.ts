import { describe, expect, it } from "vitest";

import { LOCAL_CARD_QUESTION, LOCAL_ROLE_GATE_QUESTIONS } from "./local-mock-questions";
import {
  createInitialPracticeState,
  reducePracticeCommand,
} from "./local-practice-authority";
import type { PracticeState } from "./types";

function command(state: PracticeState, input: Parameters<typeof reducePracticeCommand>[1]): PracticeState {
  return reducePracticeCommand(state, input).state;
}

function step(state: PracticeState, deltaMs = 200): PracticeState {
  return command(state, {
    type: "simulation.step",
    deltaMs,
    input: { forward: 0, right: 0, yaw: 0 },
  });
}

function killEnemy(state: PracticeState): PracticeState {
  if (state.weapon.ammo < 2) {
    state = command(state, { type: "weapon.reload" });
    for (let elapsed = 0; elapsed < 800; elapsed += 50) {
      state = step(state, 50);
    }
  }

  const offsetX = state.enemy.position.x - state.player.position.x;
  const offsetZ = state.enemy.position.z - state.player.position.z;
  const horizontalDistance = Math.hypot(offsetX, offsetZ);
  const yaw = Math.atan2(offsetX, offsetZ);
  const pitch = Math.atan2(0.5, horizontalDistance);
  state = command(state, { type: "weapon.fire", pitch, yaw });
  for (let elapsed = 0; elapsed < 200; elapsed += 50) {
    state = step(state, 50);
  }
  state = command(state, { type: "weapon.fire", pitch, yaw });
  return state;
}

describe("LocalPracticeAuthority reducer", () => {
  it("starts Vanguard freely but gates another role with untimed local mock questions", () => {
    const vanguard = command(createInitialPracticeState(), {
      type: "role.select",
      roleId: "vanguard",
    });
    expect(vanguard.phase).toBe("playing");

    let medic = command(createInitialPracticeState(), { type: "role.select", roleId: "medic" });
    expect(medic.phase).toBe("role_gate");
    expect(medic.roleGate?.requiredCorrect).toBe(2);
    expect(medic.roleGate?.question).not.toHaveProperty("correctAnswer");

    for (let index = 0; index < 2; index += 1) {
      const mock = LOCAL_ROLE_GATE_QUESTIONS[index];
      if (mock === undefined) {
        throw new Error("Missing local mock fixture");
      }
      medic = command(medic, { type: "answer.submit", answer: mock.correctAnswer });
      medic = command(medic, { type: "feedback.continue" });
    }
    expect(medic.phase).toBe("playing");
    expect(medic.selectedRoleId).toBe("medic");
  });

  it("moves the Thrall, applies hitscan damage, kills it, and respawns it", () => {
    let state = command(createInitialPracticeState(), { type: "role.select", roleId: "vanguard" });
    const startZ = state.enemy.position.z;
    state = step(state, 50);
    expect(state.enemy.position.z).toBeLessThan(startZ);

    state = killEnemy(state);
    expect(state.kills).toBe(1);
    expect(state.enemy.alive).toBe(false);
    state = step(state, 50);
    state = step(state, 50);
    for (let elapsed = 100; elapsed < 1_000; elapsed += 50) {
      state = step(state, 50);
    }
    expect(state.enemy.alive).toBe(true);
    expect(state.enemy.hp).toBe(state.enemy.maxHp);
  });

  it("pauses on kill ten and applies the selected card only after a correct timed answer", () => {
    let state = command(createInitialPracticeState(), { type: "role.select", roleId: "vanguard" });
    for (let kill = 0; kill < 10; kill += 1) {
      state = killEnemy(state);
      if (kill < 9) {
        for (let elapsed = 0; elapsed < 1_000; elapsed += 50) {
          state = step(state, 50);
        }
      }
    }

    expect(state.phase).toBe("card_pick");
    state = command(state, { type: "card.select", cardId: "calibrated_rounds" });
    expect(state.phase).toBe("card_question");
    expect(state.cardQuestion?.question).not.toHaveProperty("correctAnswer");
    state = command(state, { type: "answer.submit", answer: LOCAL_CARD_QUESTION.correctAnswer });
    expect(state.phase).toBe("card_feedback");
    expect(state.weapon.damage).toBe(60);
  });

  it("shows timeout feedback and applies ten true damage without killing the player", () => {
    let state = command(createInitialPracticeState(), { type: "role.select", roleId: "vanguard" });
    // Use a focused fixture state to test the card timeout without ten visual kills.
    state = {
      ...state,
      kills: 10,
      phase: "card_pick",
      enemy: { ...state.enemy, alive: false, hp: 0 },
    };
    state = command(state, { type: "card.select", cardId: "extended_mag" });
    for (let elapsed = 0; elapsed < 15_000; elapsed += 50) {
      state = step(state, 50);
    }

    expect(state.phase).toBe("card_feedback");
    expect(state.cardQuestion?.feedback).toMatchObject({ correct: false, timedOut: true });
    expect(state.player.hp).toBe(90);
    expect(state.player.alive).toBe(true);
  });

  it("freezes combat during the timed card question", () => {
    let state = command(createInitialPracticeState(), { type: "role.select", roleId: "vanguard" });
    state = {
      ...state,
      kills: 10,
      phase: "card_pick",
      enemy: { ...state.enemy, position: { x: 0, z: 1.2 } },
    };
    state = command(state, { type: "card.select", cardId: "crystal_plating" });
    const enemyBefore = state.enemy;
    const playerBefore = state.player;
    state = step(state, 50);

    expect(state.enemy).toEqual(enemyBefore);
    expect(state.player).toEqual(playerBefore);
    expect(state.cardQuestion?.remainingMs).toBe(14_950);
  });

  it("never lets a wrong card answer's true damage reduce HP below one", () => {
    let state = command(createInitialPracticeState(), { type: "role.select", roleId: "vanguard" });
    state = {
      ...state,
      kills: 10,
      phase: "card_pick",
      player: { ...state.player, hp: 4 },
    };
    state = command(state, { type: "card.select", cardId: "extended_mag" });
    state = command(state, { type: "answer.submit", answer: "wrong answer" });

    expect(state.player.hp).toBe(1);
    expect(state.player.alive).toBe(true);
    expect(state.cardQuestion?.feedback).toMatchObject({ correct: false, timedOut: false });
  });
});
