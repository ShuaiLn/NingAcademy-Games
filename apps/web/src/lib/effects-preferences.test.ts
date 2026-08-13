import { describe, expect, it } from "vitest";

import {
  DEFAULT_EFFECTS_PREFERENCES,
  parseStoredEffectsPreferences,
  resolveEffectsPreferences,
} from "./effects-preferences";

describe("effects preferences", () => {
  it("lets a teacher lower but never raise the student's effect ceiling", () => {
    const resolved = resolveEffectsPreferences(DEFAULT_EFFECTS_PREFERENCES, {
      allowHitStop: false,
      allowScreecherDistortion: false,
      allowSlowMotion: true,
      maxFlashMode: "reduced",
      maxScreenShakePercent: 25,
      maxShardMode: "reduced",
    });

    expect(resolved).toEqual({
      flashMode: "reduced",
      hitStop: false,
      screenShakePercent: 25,
      screecherDistortion: false,
      shardMode: "reduced",
      slowMotion: true,
    });
  });

  it("turns risky presentation effects off for OS reduced motion", () => {
    expect(resolveEffectsPreferences(DEFAULT_EFFECTS_PREFERENCES, undefined, true)).toEqual({
      flashMode: "off",
      hitStop: false,
      screenShakePercent: 0,
      screecherDistortion: false,
      shardMode: "reduced",
      slowMotion: false,
    });
  });

  it("parses and clamps persisted settings", () => {
    expect(
      parseStoredEffectsPreferences(
        JSON.stringify({
          flashMode: "off",
          hitStop: false,
          screenShakePercent: 400,
          screecherDistortion: false,
          shardMode: "reduced",
          slowMotion: false,
        }),
      ),
    ).toMatchObject({ flashMode: "off", screenShakePercent: 100 });
  });

  it("fails closed to known defaults for malformed storage", () => {
    expect(parseStoredEffectsPreferences("not-json")).toBe(DEFAULT_EFFECTS_PREFERENCES);
    expect(parseStoredEffectsPreferences('{"flashMode":"maximum"}')).toBe(
      DEFAULT_EFFECTS_PREFERENCES,
    );
  });
});
