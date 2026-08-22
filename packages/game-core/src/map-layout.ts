import { normalizeSeed } from "./prng.js";

export const GREYBOX_MAP_GENERATOR_VERSION = 1 as const;
export const GREYBOX_MAP_GRID_SIZE = 8 as const;
export const GREYBOX_MAP_CANONICAL_LAYOUT_ID = "greybox-combat-cross-v1" as const;
export const GREYBOX_MAP_COLLISION_LAYOUT_ID = "greybox-combat-cross-collision-v1" as const;
export const GREYBOX_MAP_ASSET_MANIFEST_ID = "greybox-primitives-v1" as const;

export type CombatMapRotation = 0 | 90 | 180 | 270;
export type CombatMapModuleId =
  | "arena_open"
  | "boss_reserve"
  | "cover_l"
  | "enemy_gate"
  | "player_spawn"
  | "supply_reserve";

export interface CombatMapPoint {
  readonly x: number;
  readonly z: number;
}

export interface CombatMapArea {
  readonly center: CombatMapPoint;
  readonly halfExtents: CombatMapPoint;
  readonly id: string;
}

export interface CombatMapModulePlacement {
  readonly gridX: number;
  readonly gridZ: number;
  readonly moduleId: CombatMapModuleId;
  readonly rotation: CombatMapRotation;
}

export interface CombatMapNavigationNode {
  readonly id: string;
  readonly links: readonly string[];
  readonly position: CombatMapPoint;
}

/**
 * Compact deterministic layout data. It contains module ids and collision/
 * navigation metadata, never render meshes or Babylon objects.
 */
export interface CombatMapLayout {
  readonly assetManifestId: typeof GREYBOX_MAP_ASSET_MANIFEST_ID;
  readonly bossArea: CombatMapArea;
  readonly canonicalLayoutId: typeof GREYBOX_MAP_CANONICAL_LAYOUT_ID;
  readonly collisionBoundaries: readonly CombatMapArea[];
  readonly collisionLayoutId: typeof GREYBOX_MAP_COLLISION_LAYOUT_ID;
  readonly enemySpawnZones: readonly CombatMapArea[];
  readonly generatorVersion: typeof GREYBOX_MAP_GENERATOR_VERSION;
  readonly gridSize: typeof GREYBOX_MAP_GRID_SIZE;
  readonly layoutHash: string;
  readonly modulePlacements: readonly CombatMapModulePlacement[];
  readonly navigationBounds: CombatMapArea;
  readonly navigationNodes: readonly CombatMapNavigationNode[];
  readonly playerSpawnPoints: readonly CombatMapPoint[];
  readonly playerSpawnZone: CombatMapArea;
  readonly seed: number;
  readonly supplyArea: CombatMapArea;
}

const MODULE_PLACEMENTS: readonly CombatMapModulePlacement[] = [
  { gridX: -2, gridZ: -2, moduleId: "arena_open", rotation: 0 },
  { gridX: -1, gridZ: -2, moduleId: "arena_open", rotation: 0 },
  { gridX: 0, gridZ: -2, moduleId: "enemy_gate", rotation: 180 },
  { gridX: 1, gridZ: -2, moduleId: "arena_open", rotation: 0 },
  { gridX: 2, gridZ: -2, moduleId: "arena_open", rotation: 0 },
  { gridX: -2, gridZ: -1, moduleId: "arena_open", rotation: 0 },
  { gridX: -1, gridZ: -1, moduleId: "cover_l", rotation: 0 },
  { gridX: 0, gridZ: -1, moduleId: "arena_open", rotation: 0 },
  { gridX: 1, gridZ: -1, moduleId: "cover_l", rotation: 90 },
  { gridX: 2, gridZ: -1, moduleId: "arena_open", rotation: 0 },
  { gridX: -2, gridZ: 0, moduleId: "supply_reserve", rotation: 270 },
  { gridX: -1, gridZ: 0, moduleId: "arena_open", rotation: 0 },
  { gridX: 0, gridZ: 0, moduleId: "player_spawn", rotation: 0 },
  { gridX: 1, gridZ: 0, moduleId: "arena_open", rotation: 0 },
  { gridX: 2, gridZ: 0, moduleId: "boss_reserve", rotation: 90 },
  { gridX: -2, gridZ: 1, moduleId: "arena_open", rotation: 0 },
  { gridX: -1, gridZ: 1, moduleId: "cover_l", rotation: 270 },
  { gridX: 0, gridZ: 1, moduleId: "arena_open", rotation: 0 },
  { gridX: 1, gridZ: 1, moduleId: "cover_l", rotation: 180 },
  { gridX: 2, gridZ: 1, moduleId: "arena_open", rotation: 0 },
  { gridX: -2, gridZ: 2, moduleId: "arena_open", rotation: 0 },
  { gridX: -1, gridZ: 2, moduleId: "arena_open", rotation: 0 },
  { gridX: 0, gridZ: 2, moduleId: "enemy_gate", rotation: 0 },
  { gridX: 1, gridZ: 2, moduleId: "arena_open", rotation: 0 },
  { gridX: 2, gridZ: 2, moduleId: "arena_open", rotation: 0 },
] as const;

const COLLISION_BOUNDARIES: readonly CombatMapArea[] = [
  { id: "cover-north-west", center: { x: -8, z: -8 }, halfExtents: { x: 1.5, z: 3 } },
  { id: "cover-north-east", center: { x: 8, z: -8 }, halfExtents: { x: 3, z: 1.5 } },
  { id: "cover-south-west", center: { x: -8, z: 8 }, halfExtents: { x: 3, z: 1.5 } },
  { id: "cover-south-east", center: { x: 8, z: 8 }, halfExtents: { x: 1.5, z: 3 } },
] as const;

const ENEMY_SPAWN_ZONES: readonly CombatMapArea[] = [
  { id: "enemy-north", center: { x: 0, z: -20 }, halfExtents: { x: 2.5, z: 2 } },
  { id: "enemy-east", center: { x: 20, z: 0 }, halfExtents: { x: 2, z: 2.5 } },
  { id: "enemy-south", center: { x: 0, z: 20 }, halfExtents: { x: 2.5, z: 2 } },
  { id: "enemy-west", center: { x: -20, z: 0 }, halfExtents: { x: 2, z: 2.5 } },
] as const;

const PLAYER_SPAWN_POINTS: readonly CombatMapPoint[] = [
  { x: -2.25, z: -2.25 },
  { x: 0, z: -2.25 },
  { x: 2.25, z: -2.25 },
  { x: 2.25, z: 0 },
  { x: 2.25, z: 2.25 },
  { x: 0, z: 2.25 },
  { x: -2.25, z: 2.25 },
  { x: -2.25, z: 0 },
] as const;

const NAVIGATION_NODES: readonly CombatMapNavigationNode[] = [
  { id: "center", position: { x: 0, z: 0 }, links: ["north", "east", "south", "west"] },
  { id: "north", position: { x: 0, z: -12 }, links: ["center", "enemy-north"] },
  { id: "enemy-north", position: { x: 0, z: -20 }, links: ["north"] },
  { id: "east", position: { x: 12, z: 0 }, links: ["center", "enemy-east", "boss"] },
  { id: "enemy-east", position: { x: 20, z: 0 }, links: ["east"] },
  { id: "boss", position: { x: 16, z: 0 }, links: ["east"] },
  { id: "south", position: { x: 0, z: 12 }, links: ["center", "enemy-south"] },
  { id: "enemy-south", position: { x: 0, z: 20 }, links: ["south"] },
  { id: "west", position: { x: -12, z: 0 }, links: ["center", "enemy-west", "supply"] },
  { id: "enemy-west", position: { x: -20, z: 0 }, links: ["west"] },
  { id: "supply", position: { x: -16, z: 0 }, links: ["west"] },
] as const;

type LayoutWithoutHash = Omit<CombatMapLayout, "layoutHash">;

function stableLayoutJson(layout: LayoutWithoutHash): string {
  return JSON.stringify(layout);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function calculateCombatMapLayoutHash(layout: LayoutWithoutHash): string {
  return fnv1a32(stableLayoutJson(layout));
}

/** Fixed canonical V1-greybox layout. The seed is retained in the contract so
 * the Host checkpoint and future generator revisions have one stable seam. */
export function createDeterministicGreyboxMap(seed: number | string): CombatMapLayout {
  const withoutHash: LayoutWithoutHash = {
    assetManifestId: GREYBOX_MAP_ASSET_MANIFEST_ID,
    bossArea: { id: "future-boss-arena", center: { x: 16, z: 0 }, halfExtents: { x: 5, z: 5 } },
    canonicalLayoutId: GREYBOX_MAP_CANONICAL_LAYOUT_ID,
    collisionBoundaries: COLLISION_BOUNDARIES,
    collisionLayoutId: GREYBOX_MAP_COLLISION_LAYOUT_ID,
    enemySpawnZones: ENEMY_SPAWN_ZONES,
    generatorVersion: GREYBOX_MAP_GENERATOR_VERSION,
    gridSize: GREYBOX_MAP_GRID_SIZE,
    modulePlacements: MODULE_PLACEMENTS,
    navigationBounds: { id: "navigation-bounds", center: { x: 0, z: 0 }, halfExtents: { x: 24, z: 24 } },
    navigationNodes: NAVIGATION_NODES,
    playerSpawnPoints: PLAYER_SPAWN_POINTS,
    playerSpawnZone: { id: "player-spawn-zone", center: { x: 0, z: 0 }, halfExtents: { x: 4, z: 4 } },
    seed: normalizeSeed(seed),
    supplyArea: { id: "future-supply-area", center: { x: -16, z: 0 }, halfExtents: { x: 4, z: 4 } },
  };
  return { ...withoutHash, layoutHash: calculateCombatMapLayoutHash(withoutHash) };
}

export function isCompatibleCombatMapLayout(layout: CombatMapLayout): boolean {
  if (
    layout.generatorVersion !== GREYBOX_MAP_GENERATOR_VERSION
    || layout.canonicalLayoutId !== GREYBOX_MAP_CANONICAL_LAYOUT_ID
    || layout.collisionLayoutId !== GREYBOX_MAP_COLLISION_LAYOUT_ID
    || layout.assetManifestId !== GREYBOX_MAP_ASSET_MANIFEST_ID
  ) {
    return false;
  }
  const { layoutHash, ...withoutHash } = layout;
  return layoutHash === calculateCombatMapLayoutHash(withoutHash);
}

function circleOverlapsArea(position: CombatMapPoint, radius: number, area: CombatMapArea): boolean {
  const closestX = Math.max(
    area.center.x - area.halfExtents.x,
    Math.min(position.x, area.center.x + area.halfExtents.x),
  );
  const closestZ = Math.max(
    area.center.z - area.halfExtents.z,
    Math.min(position.z, area.center.z + area.halfExtents.z),
  );
  return Math.hypot(position.x - closestX, position.z - closestZ) < radius;
}

export function mapPositionIsNavigable(
  layout: CombatMapLayout,
  position: CombatMapPoint,
  radius: number,
): boolean {
  const bounds = layout.navigationBounds;
  if (
    position.x - radius < bounds.center.x - bounds.halfExtents.x
    || position.x + radius > bounds.center.x + bounds.halfExtents.x
    || position.z - radius < bounds.center.z - bounds.halfExtents.z
    || position.z + radius > bounds.center.z + bounds.halfExtents.z
  ) {
    return false;
  }
  return !layout.collisionBoundaries.some((area) => circleOverlapsArea(position, radius, area));
}

/** Axis-separated collision slide shared by Host simulation and local prediction. */
export function moveWithinCombatMap(
  layout: CombatMapLayout,
  current: CombatMapPoint,
  delta: CombatMapPoint,
  radius: number,
): CombatMapPoint {
  const combined = { x: current.x + delta.x, z: current.z + delta.z };
  if (mapPositionIsNavigable(layout, combined, radius)) return combined;
  const xOnly = { x: combined.x, z: current.z };
  if (mapPositionIsNavigable(layout, xOnly, radius)) return xOnly;
  const zOnly = { x: current.x, z: combined.z };
  if (mapPositionIsNavigable(layout, zOnly, radius)) return zOnly;
  return current;
}

export interface CombatMapValidationResult {
  readonly issues: readonly string[];
  readonly valid: boolean;
}

export function validateCombatMapLayout(layout: CombatMapLayout): CombatMapValidationResult {
  const issues: string[] = [];
  if (!isCompatibleCombatMapLayout(layout)) issues.push("layout_hash_or_version_mismatch");
  for (const [index, point] of layout.playerSpawnPoints.entries()) {
    if (!mapPositionIsNavigable(layout, point, 0.4)) issues.push(`player_spawn_${index}_blocked`);
  }
  for (const zone of layout.enemySpawnZones) {
    if (!mapPositionIsNavigable(layout, zone.center, 0.8)) issues.push(`${zone.id}_blocked`);
  }
  const nodeIds = new Set(layout.navigationNodes.map((node) => node.id));
  for (const node of layout.navigationNodes) {
    if (!mapPositionIsNavigable(layout, node.position, 0.8)) issues.push(`${node.id}_not_navigable`);
    if (node.links.some((link) => !nodeIds.has(link))) issues.push(`${node.id}_has_unknown_link`);
  }
  const first = layout.navigationNodes[0];
  if (first !== undefined) {
    const visited = new Set<string>();
    const queue = [first.id];
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined || visited.has(id)) continue;
      visited.add(id);
      const node = layout.navigationNodes.find((candidate) => candidate.id === id);
      if (node !== undefined) queue.push(...node.links);
    }
    if (visited.size !== layout.navigationNodes.length) issues.push("navigation_graph_disconnected");
  }
  return { issues, valid: issues.length === 0 };
}
