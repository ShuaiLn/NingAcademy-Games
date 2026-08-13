import { describe, expect, it } from "vitest";

import {
  PROTOCOL_VERSION,
  createCommandEnvelope,
  createEventEnvelopes,
  decodeCommandEnvelope,
  isCombatDeathCueEvent,
  isCommandEnvelope,
  isEventEnvelope,
} from "../src/index.js";

const validInput = {
  type: "combat.input",
  aimPitch: 0,
  aimYaw: 0,
  clientTimeMs: 1_000,
  moveForward: 1,
  moveRight: 0,
  sequence: 1,
} as const;

describe("strict combat protocol DTOs", () => {
  it("accepts an exact input-intent envelope", () => {
    const envelope = createCommandEnvelope({
      commandId: "input-1",
      payload: validInput,
      roomId: "room-1",
      sentAtMs: 1_150,
    });

    expect(isCommandEnvelope(envelope)).toBe(true);
    expect(decodeCommandEnvelope(envelope)).toEqual({ ok: true, value: envelope });
  });

  it.each([
    ["kill", { kill: true }],
    ["damage", { damage: 999 }],
    ["target", { targetEntityId: "thrall-0" }],
    ["hit", { hit: true }],
    ["identity", { userId: "forged-user" }],
    ["teleport", { position: { x: 999, z: 999 } }],
  ])("rejects forged %s fields", (_name, forgedField) => {
    const value = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "game.command",
      roomId: "room-1",
      commandId: "forged",
      sentAtMs: 1_150,
      payload: { ...validInput, ...forgedField },
    };

    expect(isCommandEnvelope(value)).toBe(false);
    expect(decodeCommandEnvelope(value)).toMatchObject({
      ok: false,
      error: { code: "INVALID_ENVELOPE" },
    });
  });

  it("accepts only the compact no-blood death cue shape", () => {
    const cue = {
      type: "combat.death_cue",
      biome: "house",
      entityId: "thrall-0",
      pos: [123, 105, -456],
      seed: 42,
    } as const;
    const [envelope] = createEventEnvelopes({
      events: [cue],
      occurredAtMs: 1_200,
      revision: 10,
      roomId: "room-1",
    });

    expect(isCombatDeathCueEvent(cue)).toBe(true);
    expect(isEventEnvelope(envelope)).toBe(true);
    expect(JSON.stringify(cue)).not.toMatch(/blood|gore|corpse|fragment|shard/i);
    expect(isCombatDeathCueEvent({ ...cue, shardTransforms: [] })).toBe(false);
    expect(isCombatDeathCueEvent({ ...cue, blood: false })).toBe(false);
  });
});
