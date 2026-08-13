import { describe, expect, it } from "vitest";

import { FlashGovernor } from "./flash-governor";

const highContrastRequest = (atMs: number) => ({
  atMs,
  cueId: `cue-${atMs}`,
  highContrast: true,
  saturatedRed: false,
});

describe("FlashGovernor", () => {
  it("enforces one global two-flash rolling budget", () => {
    const governor = new FlashGovernor();

    expect(governor.request(highContrastRequest(100)).kind).toBe("render");
    expect(governor.request(highContrastRequest(400)).kind).toBe("render");
    expect(governor.request(highContrastRequest(900))).toMatchObject({
      kind: "fallback",
      reason: "rate_limited",
    });
  });

  it("releases an event after it leaves the rolling window", () => {
    const governor = new FlashGovernor();

    governor.request(highContrastRequest(100));
    governor.request(highContrastRequest(400));

    expect(governor.request(highContrastRequest(1_100)).kind).toBe("render");
  });

  it("does not spend the budget on low-contrast cues", () => {
    const governor = new FlashGovernor();

    for (let index = 0; index < 20; index += 1) {
      expect(
        governor.request({
          ...highContrastRequest(index * 20),
          highContrast: false,
        }).kind,
      ).toBe("render");
    }

    expect(governor.request(highContrastRequest(500)).kind).toBe("render");
    expect(governor.request(highContrastRequest(600)).kind).toBe("render");
  });

  it("always replaces saturated-red and reduced-motion flashes", () => {
    const governor = new FlashGovernor({ mode: "reduced" });

    expect(governor.request(highContrastRequest(10))).toMatchObject({
      kind: "fallback",
      reason: "reduced_motion",
    });

    governor.setMode("normal");
    expect(
      governor.request({ ...highContrastRequest(20), saturatedRed: true }),
    ).toMatchObject({ kind: "fallback", reason: "saturated_red" });
  });

  it("starts a fresh budget when a scene clock restarts", () => {
    const governor = new FlashGovernor();

    governor.request(highContrastRequest(5_000));
    governor.request(highContrastRequest(5_100));

    expect(governor.request(highContrastRequest(0)).kind).toBe("render");
  });
});
