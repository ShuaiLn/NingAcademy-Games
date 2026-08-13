import { describe, expect, it } from "vitest";

import { getRoleGateRequirement, survivorRoles } from "./role-gate";

describe("pre-game role learning gate", () => {
  it("keeps the first unlocked role free", () => {
    expect(getRoleGateRequirement("vanguard", new Set())).toEqual({
      questionCount: 0,
      timed: false,
    });
  });

  it("requires progressively more untimed questions for a new role", () => {
    expect(
      survivorRoles.map((role) =>
        getRoleGateRequirement(role.id, new Set()).questionCount,
      ),
    ).toEqual([0, 2, 3, 4, 5]);
  });

  it("uses one untimed warm-up question for an already unlocked role", () => {
    expect(getRoleGateRequirement("medic", new Set(["medic"]))).toEqual({
      questionCount: 1,
      timed: false,
    });
  });
});
