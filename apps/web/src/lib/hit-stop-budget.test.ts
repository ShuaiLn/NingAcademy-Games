import { describe, expect, it } from "vitest";

import { HitStopBudget } from "./hit-stop-budget";

describe("HitStopBudget", () => {
  it("uses cue-specific durations without exceeding 80ms per second", () => {
    const budget = new HitStopBudget();

    expect(budget.request("normal_hit", 0)).toBe(20);
    expect(budget.request("weakpoint_hit", 100)).toBe(30);
    expect(budget.request("part_break", 200)).toBe(30);
    expect(budget.request("kill", 300)).toBe(0);
  });

  it("does not grant hit stop when accessibility settings disable it", () => {
    const budget = new HitStopBudget();
    budget.setEnabled(false);

    expect(budget.request("part_break", 0)).toBe(0);
  });

  it("recovers budget after the rolling window", () => {
    const budget = new HitStopBudget();
    budget.request("part_break", 0);
    budget.request("weakpoint_hit", 100);

    expect(budget.request("part_break", 1_100)).toBe(50);
  });
});
