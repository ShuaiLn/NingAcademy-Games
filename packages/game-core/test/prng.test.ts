import { describe, expect, it } from "vitest";

import { createRandomState, nextUint32, shuffle } from "../src/index.js";

describe("seeded PRNG", () => {
  it("replays the same stream from the same seed", () => {
    let left = createRandomState("room-seed");
    let right = createRandomState("room-seed");

    for (let index = 0; index < 20; index += 1) {
      const leftDraw = nextUint32(left);
      const rightDraw = nextUint32(right);
      expect(leftDraw.value).toBe(rightDraw.value);
      left = leftDraw.state;
      right = rightDraw.state;
    }

    expect(left.draws).toBe(20);
  });

  it("shuffles without mutating its input", () => {
    const source = ["a", "b", "c", "d"] as const;
    const draw = shuffle(createRandomState(42), source);

    expect(source).toEqual(["a", "b", "c", "d"]);
    expect([...draw.value].sort()).toEqual([...source].sort());
    expect(draw.state.draws).toBe(3);
  });
});
