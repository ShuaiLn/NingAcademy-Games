import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Node } from "@babylonjs/core/node";
import type { Scene } from "@babylonjs/core/scene";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import type {
  AnimationSemantic,
  ModelAssetDefinition,
  ThrallBiome,
} from "./model-asset-registry";

type TintableMaterial = Material & {
  albedoColor?: Color3;
  diffuseColor?: Color3;
  emissiveColor?: Color3;
  metallic?: number;
  roughness?: number;
};

export interface RuntimeTechnicalNode {
  readonly kind: "collision" | "hitbox" | "hurtbox";
  readonly name: string;
  readonly node: Node;
  readonly specification: Readonly<Record<string, unknown>> | null;
}

export interface LoadedModelAsset {
  readonly animationGroups: readonly AnimationGroup[];
  readonly definition: ModelAssetDefinition;
  readonly materials: readonly Material[];
  readonly nodes: readonly Node[];
  readonly renderMeshes: readonly AbstractMesh[];
  readonly root: TransformNode;
  readonly skeletons: readonly Skeleton[];
  readonly technicalNodes: readonly RuntimeTechnicalNode[];
  dispose(): void;
  findNode(name: string): Node | null;
  playAnimation(semantic: AnimationSemantic, loop?: boolean, speedRatio?: number): boolean;
  setDetailVisible(visible: boolean): void;
  setDistanceFromCamera(distance: number): void;
}

function normalizeNodeName(value: string): string {
  return value.trim().replace(/\.\d{3}$/u, "").toUpperCase();
}

function normalizeAnimationName(value: string): string {
  return value.trim().replace(/^ANIM_/iu, "").toLowerCase();
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readGltfExtras(node: Node): Readonly<Record<string, unknown>> | null {
  const metadata: unknown = node.metadata;
  if (!isRecord(metadata) || !isRecord(metadata.gltf) || !isRecord(metadata.gltf.extras)) {
    return null;
  }
  return metadata.gltf.extras;
}

function classifyTechnicalNode(node: Node): RuntimeTechnicalNode | null {
  const normalized = normalizeNodeName(node.name);
  const kind = normalized.startsWith("COL_")
    ? "collision"
    : normalized.startsWith("HIT_")
      ? "hitbox"
      : normalized.startsWith("HURT_")
        ? "hurtbox"
        : null;
  return kind === null
    ? null
    : { kind, name: node.name, node, specification: readGltfExtras(node) };
}

function isDetailMesh(mesh: AbstractMesh): boolean {
  return /(?:CORE|CORESHELL|DETAIL|SHARD|SHELL|LENS|BOLT|CHARGINGHANDLE)/iu.test(mesh.name);
}

function splitAssetUrl(path: string): { readonly fileName: string; readonly rootUrl: string } {
  const slash = path.lastIndexOf("/");
  if (slash < 0 || slash === path.length - 1) {
    throw new Error(`invalid model URL: ${path}`);
  }
  return { fileName: path.slice(slash + 1), rootUrl: path.slice(0, slash + 1) };
}

/**
 * Imports one approved GLB and exposes presentation-only nodes. Babylon picks
 * and imported collision objects are deliberately disabled: authoritative
 * damage, HP, hits and movement continue to come from the authority adapter.
 */
export async function loadModelAsset(
  scene: Scene,
  definition: ModelAssetDefinition,
): Promise<LoadedModelAsset> {
  await import("@babylonjs/loaders/glTF");
  const { SceneLoader } = await import("@babylonjs/core/Loading/sceneLoader");
  const { fileName, rootUrl } = splitAssetUrl(definition.path);
  const result = await SceneLoader.ImportMeshAsync(null, rootUrl, fileName, scene);

  const root = new TransformNode(`RUNTIME_${definition.assetId}`, scene);
  const allNodes = [...result.transformNodes, ...result.meshes];
  const nodeSet = new Set<Node>(allNodes);
  for (const node of allNodes) {
    if (node.parent === null || !nodeSet.has(node.parent)) {
      node.parent = root;
    }
  }

  const technicalNodes = allNodes
    .map(classifyTechnicalNode)
    .filter((node): node is RuntimeTechnicalNode => node !== null);
  const technicalNames = new Set(technicalNodes.map((node) => normalizeNodeName(node.name)));
  const renderMeshes = result.meshes.filter((mesh) => {
    const normalized = normalizeNodeName(mesh.name);
    return normalized !== "__ROOT__" && !technicalNames.has(normalized);
  });
  for (const mesh of result.meshes) {
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    if (technicalNames.has(normalizeNodeName(mesh.name))) {
      mesh.isVisible = false;
      mesh.setEnabled(false);
    }
  }

  for (const animation of result.animationGroups) {
    animation.stop();
    animation.reset();
  }

  const names = new Set([
    ...allNodes.map((node) => normalizeNodeName(node.name)),
    ...result.skeletons.map((skeleton) => normalizeNodeName(skeleton.name)),
  ]);
  const missing = definition.requiredNodes.filter((name) => !names.has(normalizeNodeName(name)));
  if (missing.length > 0) {
    for (const animation of result.animationGroups) animation.dispose();
    for (const skeleton of result.skeletons) skeleton.dispose();
    root.dispose(false, true);
    throw new Error(`${definition.assetId} is missing required nodes: ${missing.join(", ")}`);
  }

  const materials = [...new Set(renderMeshes.flatMap((mesh) => mesh.material ? [mesh.material] : []))];
  let currentAnimation: AnimationGroup | null = null;
  let detailVisible = true;

  const findNode = (name: string): Node | null => {
    const normalized = normalizeNodeName(name);
    return allNodes.find((node) => normalizeNodeName(node.name) === normalized) ?? null;
  };

  const setDetailVisible = (visible: boolean): void => {
    if (detailVisible === visible) return;
    detailVisible = visible;
    for (const mesh of renderMeshes) {
      if (isDetailMesh(mesh)) mesh.setEnabled(visible);
    }
  };

  return {
    animationGroups: result.animationGroups,
    definition,
    materials,
    nodes: allNodes,
    renderMeshes,
    root,
    skeletons: result.skeletons,
    technicalNodes,
    dispose: () => {
      for (const animation of result.animationGroups) animation.dispose();
      for (const skeleton of result.skeletons) skeleton.dispose();
      root.dispose(false, true);
    },
    findNode,
    playAnimation: (semantic, loop = semantic === "idle" || semantic === "move" || semantic === "run", speedRatio = 1) => {
      const candidates = definition.animationMap[semantic] ?? [];
      const normalizedCandidates = new Set(candidates.map(normalizeAnimationName));
      const animation = result.animationGroups.find(
        (group) => normalizedCandidates.has(normalizeAnimationName(group.name)),
      );
      if (animation === undefined) return false;
      if (animation === currentAnimation && animation.isPlaying) return true;
      currentAnimation?.stop();
      currentAnimation = animation;
      animation.start(loop, speedRatio, animation.from, animation.to, false);
      return true;
    },
    setDetailVisible,
    setDistanceFromCamera: (distance) => {
      const finiteDistance = Number.isFinite(distance) ? Math.max(0, distance) : Number.POSITIVE_INFINITY;
      root.setEnabled(finiteDistance <= definition.lod.cullDistance);
      setDetailVisible(finiteDistance <= definition.lod.detailDistance);
    },
  };
}

const BIOME_TINTS: Readonly<Record<ThrallBiome, {
  readonly body: readonly [number, number, number];
  readonly crystal: readonly [number, number, number];
  readonly emissive: readonly [number, number, number];
}>> = {
  house: {
    body: [0.52, 0.46, 0.62],
    crystal: [0.545, 0.361, 0.965],
    emissive: [0.24, 0.1, 0.62],
  },
  grassland: {
    body: [0.45, 0.57, 0.48],
    crystal: [0.29, 0.871, 0.502],
    emissive: [0.08, 0.48, 0.19],
  },
  desert: {
    body: [0.67, 0.59, 0.43],
    crystal: [0.91, 0.769, 0.408],
    emissive: [0.5, 0.3, 0.07],
  },
  hell: {
    body: [0.3, 0.25, 0.24],
    crystal: [0.11, 0.098, 0.09],
    emissive: [0.8, 0.22, 0.025],
  },
};

function updateTintMaterial(
  material: TintableMaterial,
  biome: ThrallBiome,
  damageFlash: number,
): void {
  const tint = BIOME_TINTS[biome];
  const crystal = /CRYSTAL|HOUSE|GRASS|DESERT|HELL/iu.test(material.name);
  const base = crystal ? tint.crystal : tint.body;
  const flash = Math.min(1, Math.max(0, damageFlash));
  const color = new Color3(
    Math.min(1, base[0] + flash * 0.24),
    Math.min(1, base[1] + flash * 0.18),
    Math.min(1, base[2] + flash * 0.28),
  );
  material.albedoColor?.copyFrom(color);
  material.diffuseColor?.copyFrom(color);
  if (crystal && material.emissiveColor !== undefined) {
    material.emissiveColor.copyFromFloats(
      Math.min(1, tint.emissive[0] + flash * 0.32),
      Math.min(1, tint.emissive[1] + flash * 0.24),
      Math.min(1, tint.emissive[2] + flash * 0.4),
    );
    material.metallic = 0.12;
    material.roughness = 0.3;
  }
}

export function applyThrallBiomeMaterials(
  assets: readonly LoadedModelAsset[],
  biome: ThrallBiome,
  damageFlash = 0,
): void {
  for (const asset of assets) {
    for (const material of asset.materials) {
      updateTintMaterial(material, biome, damageFlash);
    }
  }
}
