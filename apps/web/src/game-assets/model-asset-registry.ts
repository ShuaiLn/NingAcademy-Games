export type ModelAssetKind =
  | "boss"
  | "enemy"
  | "enemy_attachment"
  | "survivor"
  | "vfx"
  | "weapon_fp"
  | "weapon_tp";

export type AnimationSemantic =
  | "idle"
  | "move"
  | "run"
  | "attack"
  | "hit"
  | "death"
  | "spawn"
  | "stagger"
  | "skill_a"
  | "skill_b"
  | "ultimate"
  | "phase_break"
  | "summon";

export interface ModelLodPolicy {
  /** Hide small silhouette/detail meshes after this camera distance. */
  readonly detailDistance: number;
  /** Stop submitting the whole model after this camera distance. */
  readonly cullDistance: number;
}

export interface ModelAssetDefinition {
  readonly animationMap: Partial<Readonly<Record<AnimationSemantic, readonly string[]>>>;
  readonly assetId: string;
  readonly kind: ModelAssetKind;
  readonly lod: ModelLodPolicy;
  readonly path: string;
  readonly requiredNodes: readonly string[];
}

const MODEL_ROOT = "/game/models";

export const THRALL_MODEL = {
  animationMap: {
    idle: ["ANIM_Idle_01", "ANIM_Idle_02"],
    move: ["ANIM_Walk"],
    run: ["ANIM_Run"],
    attack: ["ANIM_Attack_01", "ANIM_Attack_02"],
    hit: ["ANIM_Hit_Front", "ANIM_Hit_Back"],
    death: ["ANIM_Death_01", "ANIM_Death_02"],
    spawn: ["ANIM_Spawn"],
    stagger: ["ANIM_Stagger"],
  },
  assetId: "CHR_ENEMY_ThrallBase_v01",
  kind: "enemy",
  lod: { detailDistance: 22, cullDistance: 42 },
  path: `${MODEL_ROOT}/zombie/CHR_ENEMY_ThrallBase_v01.glb`,
  requiredNodes: [
    "SKEL_Enemy",
    "MESH_Body",
    "MESH_Core",
    "MESH_CoreShell",
    "COL_Body",
    "HIT_Fist_L",
    "HIT_Fist_R",
    "HURT_Chest",
    "HURT_Head",
    "SOCKET_Chest",
    "SOCKET_Shard_00",
    "SOCKET_Shard_07",
  ],
} as const satisfies ModelAssetDefinition;

export type ThrallBiome = "house" | "grassland" | "desert" | "hell";

export const THRALL_BIOME_ATTACHMENTS: Readonly<Record<ThrallBiome, ModelAssetDefinition>> = {
  house: {
    animationMap: {},
    assetId: "ATT_House_Thrall_A_v01",
    kind: "enemy_attachment",
    lod: { detailDistance: 22, cullDistance: 42 },
    path: `${MODEL_ROOT}/zombie/ATT_House_Thrall_A_v01.glb`,
    requiredNodes: [],
  },
  grassland: {
    animationMap: {},
    assetId: "ATT_Grass_Thrall_A_v01",
    kind: "enemy_attachment",
    lod: { detailDistance: 22, cullDistance: 42 },
    path: `${MODEL_ROOT}/zombie/ATT_Grass_Thrall_A_v01.glb`,
    requiredNodes: [],
  },
  desert: {
    animationMap: {},
    assetId: "ATT_Desert_Thrall_A_v01",
    kind: "enemy_attachment",
    lod: { detailDistance: 22, cullDistance: 42 },
    path: `${MODEL_ROOT}/zombie/ATT_Desert_Thrall_A_v01.glb`,
    requiredNodes: [],
  },
  hell: {
    animationMap: {},
    assetId: "ATT_Hell_Thrall_A_v01",
    kind: "enemy_attachment",
    lod: { detailDistance: 22, cullDistance: 42 },
    path: `${MODEL_ROOT}/zombie/ATT_Hell_Thrall_A_v01.glb`,
    requiredNodes: [],
  },
};

export type SurvivorModelId = "assassin" | "guardian" | "mage" | "medic" | "warrior";

const survivorAnimationMap = {
  idle: ["idle", "ANIM_Idle"],
  move: ["walk", "ANIM_Walk"],
  run: ["run", "ANIM_Run"],
  attack: ["attack", "ANIM_Attack"],
  hit: ["hit", "ANIM_Hit"],
  death: ["death", "ANIM_Death"],
} as const;

export const SURVIVOR_MODELS: Readonly<Record<SurvivorModelId, ModelAssetDefinition>> = {
  assassin: survivor("Assassin"),
  guardian: survivor("Guardian"),
  mage: survivor("Mage"),
  medic: survivor("Medic"),
  warrior: survivor("Warrior"),
};

function survivor(name: "Assassin" | "Guardian" | "Mage" | "Medic" | "Warrior"): ModelAssetDefinition {
  return {
    animationMap: survivorAnimationMap,
    assetId: `CHR_SURV_${name}_v01`,
    kind: "survivor",
    lod: { detailDistance: 24, cullDistance: 55 },
    path: `${MODEL_ROOT}/survivors/CHR_SURV_${name}_v01.glb`,
    requiredNodes: [],
  };
}

export type BossModelId = "hunter" | "ironshell" | "plague" | "swarm";

const bossAnimationMap = {
  idle: ["idle"],
  move: ["walk"],
  run: ["run"],
  attack: ["attack_primary"],
  skill_a: ["ability_cast"],
  hit: ["hit"],
  death: ["death"],
  phase_break: ["phase_change", "break_react"],
  stagger: ["stagger"],
  ultimate: ["ultimate"],
  summon: ["summon"],
} as const;

function boss(name: "Hunter" | "IronShell" | "Plague" | "Swarm", id: BossModelId): ModelAssetDefinition {
  return {
    animationMap: bossAnimationMap,
    assetId: `CHR_BOSS_${name}_v01`,
    kind: "boss",
    lod: { detailDistance: 34, cullDistance: 80 },
    path: `${MODEL_ROOT}/boss/${id}/CHR_BOSS_${name}_v01.glb`,
    requiredNodes: [
      `SKEL_BOSS_${name}`,
      "COL_Body",
    ],
  };
}

export const BOSS_MODELS: Readonly<Record<BossModelId, ModelAssetDefinition>> = {
  hunter: boss("Hunter", "hunter"),
  ironshell: boss("IronShell", "ironshell"),
  plague: boss("Plague", "plague"),
  swarm: boss("Swarm", "swarm"),
};

export const ASSAULT_RIFLE_FP = {
  animationMap: {},
  assetId: "WPN_Rifle_Assault_A_FP_v01",
  kind: "weapon_fp",
  lod: { detailDistance: Number.POSITIVE_INFINITY, cullDistance: Number.POSITIVE_INFINITY },
  path: `${MODEL_ROOT}/weapons/starter/assault_rifle/fp/WPN_Rifle_Assault_A_FP_v01.glb`,
  requiredNodes: [
    "MESH_Magazine",
    "MESH_Weapon",
    "SOCKET_ADS",
    "SOCKET_Eject",
    "SOCKET_Grip_L",
    "SOCKET_Grip_R",
    "SOCKET_Muzzle",
  ],
} as const satisfies ModelAssetDefinition;

export const ASSAULT_RIFLE_TP = {
  animationMap: {},
  assetId: "WPN_Rifle_Assault_A_TP_v01",
  kind: "weapon_tp",
  lod: { detailDistance: 26, cullDistance: 55 },
  path: `${MODEL_ROOT}/weapons/starter/assault_rifle/tp/WPN_Rifle_Assault_A_TP_v01.glb`,
  requiredNodes: [
    "MESH_Weapon",
    "SOCKET_Grip_L",
    "SOCKET_Grip_R",
    "SOCKET_Muzzle",
  ],
} as const satisfies ModelAssetDefinition;

export const HOUSE_SHARD_PACK = {
  animationMap: {},
  assetId: "VFX_CrystalShards_House_v01",
  kind: "vfx",
  lod: { detailDistance: 18, cullDistance: 35 },
  path: `${MODEL_ROOT}/weapons/ability_vfx_mesh/crystal_shards/house/VFX_CrystalShards_House_v01.glb`,
  requiredNodes: [],
} as const satisfies ModelAssetDefinition;

export const STATIC_MODEL_ASSETS = [
  THRALL_MODEL,
  ...Object.values(THRALL_BIOME_ATTACHMENTS),
  ...Object.values(SURVIVOR_MODELS),
  ...Object.values(BOSS_MODELS),
  ASSAULT_RIFLE_FP,
  ASSAULT_RIFLE_TP,
  HOUSE_SHARD_PACK,
] as const;

export interface WeaponCatalogAsset {
  readonly animations: number;
  readonly assetId: string;
  readonly dimensions: readonly [number, number, number];
  readonly folder: string;
  readonly materials: number;
  readonly meshes: number;
  readonly path: string;
  readonly skins: number;
  readonly status: "PASS";
  readonly triangles: number;
}

export interface WeaponCatalog {
  readonly assets: readonly WeaponCatalogAsset[];
  readonly stage3SpecPending: readonly string[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCatalogAsset(value: unknown): WeaponCatalogAsset | null {
  if (!isRecord(value)) return null;
  const dimensions = value.dimensions_m_xyz;
  if (
    typeof value.asset_id !== "string"
    || typeof value.folder !== "string"
    || value.status !== "PASS"
    || !Array.isArray(dimensions)
    || dimensions.length !== 3
    || dimensions.some((item) => typeof item !== "number" || !Number.isFinite(item))
  ) {
    return null;
  }

  const numericKeys = ["animations", "materials", "meshes", "skins", "triangles"] as const;
  if (numericKeys.some((key) => typeof value[key] !== "number" || !Number.isFinite(value[key]))) {
    return null;
  }

  return {
    animations: value.animations as number,
    assetId: value.asset_id,
    dimensions: dimensions as [number, number, number],
    folder: value.folder,
    materials: value.materials as number,
    meshes: value.meshes as number,
    path: `${MODEL_ROOT}/weapons/${value.folder}/${value.asset_id}.glb`,
    skins: value.skins as number,
    status: "PASS",
    triangles: value.triangles as number,
  };
}

/**
 * Loads the approved 51-model catalog on demand. Calling code still chooses a
 * small gameplay subset; this function must never be used to preload all GLBs.
 */
export async function fetchWeaponCatalog(
  fetcher: typeof fetch = fetch,
): Promise<WeaponCatalog> {
  const response = await fetcher(`${MODEL_ROOT}/weapons/WEAPONS_Catalog_v01.json`, {
    cache: "force-cache",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`weapon catalog request failed (${response.status})`);
  }

  const raw: unknown = await response.json();
  if (!isRecord(raw) || !Array.isArray(raw.assets) || !Array.isArray(raw.stage3_spec_pending)) {
    throw new Error("weapon catalog has an invalid shape");
  }
  const assets = raw.assets.map(parseCatalogAsset);
  if (assets.length !== 51 || assets.some((asset) => asset === null)) {
    throw new Error("weapon catalog must contain 51 approved assets");
  }
  const pending = raw.stage3_spec_pending;
  if (pending.some((item) => typeof item !== "string")) {
    throw new Error("weapon catalog stage-3 list is invalid");
  }

  return {
    assets: assets as WeaponCatalogAsset[],
    stage3SpecPending: pending as string[],
  };
}
