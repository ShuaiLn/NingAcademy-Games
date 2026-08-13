import { describe, expect, it } from "vitest";

import {
  prefersReducedMotion,
  supportsWebGl2,
  type CanvasProbe,
} from "./browser-capabilities";

describe("browser capability checks", () => {
  it("accepts a WebGL2 context", () => {
    const canvas: CanvasProbe = {
      getContext: () => ({ version: 2 }),
    };

    expect(supportsWebGl2(canvas)).toBe(true);
  });

  it("fails closed when WebGL2 probing throws", () => {
    const canvas: CanvasProbe = {
      getContext: () => {
        throw new Error("GPU unavailable");
      },
    };

    expect(supportsWebGl2(canvas)).toBe(false);
  });

  it("uses the operating-system reduced-motion preference", () => {
    expect(prefersReducedMotion({ matches: true })).toBe(true);
    expect(prefersReducedMotion({ matches: false })).toBe(false);
  });
});
