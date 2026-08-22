import { describe, expect, it } from "vitest";

import {
  createDeterministicGreyboxMap,
  isCompatibleCombatMapLayout,
  mapPositionIsNavigable,
  moveWithinCombatMap,
  validateCombatMapLayout,
  type CombatMapLayout,
} from "../src/index.js";

describe("P6 deterministic greybox map", () => {
  it("builds the same compact canonical layout and hash from the shared seed", () => {
    const host = createDeterministicGreyboxMap("room-seed");
    const peer = createDeterministicGreyboxMap("room-seed");
    const otherRoom = createDeterministicGreyboxMap("other-room-seed");

    expect(peer).toEqual(host);
    expect(peer.layoutHash).toBe(host.layoutHash);
    expect(otherRoom.layoutHash).not.toBe(host.layoutHash);
    expect(otherRoom.modulePlacements).toEqual(host.modulePlacements);
    expect(host.modulePlacements).toHaveLength(25);
    expect(validateCombatMapLayout(host)).toEqual({ issues: [], valid: true });
  });

  it("exposes explicit player/enemy zones and reserved supply/boss areas", () => {
    const layout = createDeterministicGreyboxMap(42);

    expect(layout.playerSpawnPoints).toHaveLength(8);
    expect(layout.enemySpawnZones.map((zone) => zone.id)).toEqual([
      "enemy-north",
      "enemy-east",
      "enemy-south",
      "enemy-west",
    ]);
    expect(layout.supplyArea.id).toBe("future-supply-area");
    expect(layout.bossArea.id).toBe("future-boss-arena");
    expect(layout.playerSpawnPoints.every((point) => mapPositionIsNavigable(layout, point, 0.4)))
      .toBe(true);
  });

  it("shares authoritative collision boundaries with local prediction", () => {
    const layout = createDeterministicGreyboxMap(42);
    const beforeCover = { x: -8, z: -4.5 };
    const blockedMove = moveWithinCombatMap(layout, beforeCover, { x: 0, z: -4 }, 0.4);

    expect(mapPositionIsNavigable(layout, { x: -8, z: -8 }, 0.4)).toBe(false);
    expect(blockedMove).toEqual(beforeCover);
    expect(mapPositionIsNavigable(layout, { x: 24, z: 0 }, 0.4)).toBe(false);
  });

  it("rejects altered layout metadata instead of accepting a divergent late join map", () => {
    const layout = createDeterministicGreyboxMap("room-seed");
    const altered = {
      ...layout,
      playerSpawnPoints: [{ x: 999, z: 999 }, ...layout.playerSpawnPoints.slice(1)],
    } as CombatMapLayout;

    expect(isCompatibleCombatMapLayout(altered)).toBe(false);
    expect(validateCombatMapLayout(altered).valid).toBe(false);
  });
});
