import { describe, expect, it } from "vitest";

import {
  BOSS_MODELS,
  STATIC_MODEL_ASSETS,
  SURVIVOR_MODELS,
  THRALL_BIOME_ATTACHMENTS,
  THRALL_MODEL,
  fetchWeaponCatalog,
} from "./model-asset-registry";

describe("model asset registry", () => {
  it("uses unique, normalized runtime ids and paths", () => {
    expect(new Set(STATIC_MODEL_ASSETS.map((asset) => asset.assetId)).size).toBe(
      STATIC_MODEL_ASSETS.length,
    );
    for (const asset of STATIC_MODEL_ASSETS) {
      expect(asset.path).toMatch(/^\/game\/models\/.+\.glb$/);
      expect(asset.path).not.toMatch(/[\\ ]|\(1\)|\/boss\/(Hunter|Plague|Swarm)\.glb$/);
    }
  });

  it("keeps all four bosses independent and biome agnostic", () => {
    const bosses = Object.entries(BOSS_MODELS);
    expect(bosses.map(([id]) => id).sort()).toEqual(["hunter", "ironshell", "plague", "swarm"]);
    expect(new Set(bosses.map(([, asset]) => asset.path)).size).toBe(4);
    for (const [id, asset] of bosses) {
      expect(asset.path).toContain(`/boss/${id}/`);
      expect(asset.path).not.toMatch(/\/(?:house|grass|desert|hell)\//i);
      expect(asset.requiredNodes).toContain("COL_Body");
    }
  });

  it("maps all survivor and Thrall variants without changing authority data", () => {
    expect(Object.keys(SURVIVOR_MODELS).sort()).toEqual([
      "assassin",
      "guardian",
      "mage",
      "medic",
      "warrior",
    ]);
    expect(Object.keys(THRALL_BIOME_ATTACHMENTS).sort()).toEqual([
      "desert",
      "grassland",
      "hell",
      "house",
    ]);
    expect(THRALL_MODEL.requiredNodes).toContain("HURT_Chest");
    expect(THRALL_MODEL.requiredNodes).toContain("COL_Body");
  });

  it("parses the 51-entry catalog and rejects failed catalogs", async () => {
    const asset = {
      animations: 0,
      asset_id: "WPN_Test_FP_v01",
      dimensions_m_xyz: [1, 2, 3],
      folder: "starter/test/fp",
      materials: 1,
      meshes: 1,
      skins: 0,
      status: "PASS",
      triangles: 12,
    };
    const response = new Response(JSON.stringify({
      assets: Array.from({ length: 51 }, (_, index) => ({
        ...asset,
        asset_id: `WPN_Test_${index}_FP_v01`,
      })),
      stage3_spec_pending: ["Laser_Stage3"],
    }));
    const catalog = await fetchWeaponCatalog(() => Promise.resolve(response));
    expect(catalog.assets).toHaveLength(51);
    expect(catalog.assets[0]?.path).toBe(
      "/game/models/weapons/starter/test/fp/WPN_Test_0_FP_v01.glb",
    );
  });
});
