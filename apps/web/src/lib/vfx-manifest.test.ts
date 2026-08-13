import { describe, expect, it } from "vitest";

import {
  crystalDeathCues,
  validateVfxManifest,
  type VfxCueManifest,
} from "./vfx-manifest";

describe("VFX manifest", () => {
  it("accepts the no-blood crystal death cue family", () => {
    expect(validateVfxManifest(crystalDeathCues)).toEqual([]);
  });

  it("rejects gore tags, saturated red, excessive cost, and missing fallback", () => {
    const unsafeCue: VfxCueManifest = {
      id: "unsafe",
      biomeVariants: {
        grassland: "unsafe",
        house: "unsafe",
        desert: "unsafe",
        hell: "unsafe",
      },
      fallbackCue: "missing",
      flashClass: "local_high_contrast",
      luminanceEnvelope: [1, 0],
      motionClass: "impact",
      poolCost: { drawCalls: 5, particles: 2_048, shards: 321 },
      saturatedRed: true,
      tags: ["blood"],
    };

    const messages = validateVfxManifest([unsafeCue]).map((issue) => issue.message);

    expect(messages).toContain("saturated-red flashes are forbidden");
    expect(messages).toContain("blood/gore presentation is forbidden");
    expect(messages).toContain("cue exceeds the global VFX pool budget");
    expect(messages).toContain("missing fallback cue missing");
  });
});
