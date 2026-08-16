import { describe, expect, it } from "vitest";

import { getRoleGateRequirement, survivorRoles } from "./role-gate";

describe("pre-game role learning gate", () => {
  it("keeps the first unlocked role free", () => {
    expect(getRoleGateRequirement("warrior", new Set())).toEqual({
      minimumFirstAttemptAccuracy: 0,
      questionCount: 0,
      timed: false,
    });
  });

  it("requires ten untimed questions for every new non-default role", () => {
    expect(
      survivorRoles.map((role) =>
        getRoleGateRequirement(role.id, new Set()).questionCount,
      ),
    ).toEqual([0, 10, 10, 10, 10]);
  });

  it("uses one untimed warm-up question for an already unlocked role", () => {
    expect(getRoleGateRequirement("medic", new Set(["medic"]))).toEqual({
      minimumFirstAttemptAccuracy: 1,
      questionCount: 1,
      timed: false,
    });
  });
});
