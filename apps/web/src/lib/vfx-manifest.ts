export type Biome = "grassland" | "house" | "desert" | "hell";
export type FlashClass = "none" | "local_low_contrast" | "local_high_contrast";
export type MotionClass = "none" | "ambient" | "impact" | "cinematic";

export interface VfxPoolCost {
  readonly drawCalls: number;
  readonly particles: number;
  readonly shards: number;
}

export interface VfxCueManifest {
  readonly id: string;
  readonly biomeVariants: Readonly<Record<Biome, string>>;
  readonly fallbackCue: string;
  readonly flashClass: FlashClass;
  readonly luminanceEnvelope: readonly number[];
  readonly motionClass: MotionClass;
  readonly poolCost: VfxPoolCost;
  readonly saturatedRed: boolean;
  readonly tags: readonly string[];
}

export interface VfxManifestIssue {
  readonly cueId: string;
  readonly message: string;
}

const FORBIDDEN_GORE_TAGS = new Set([
  "blood",
  "corpse_chunk",
  "dismemberment",
  "gore",
  "red_liquid_decal",
  "splash",
]);

const MAX_POOL_COST: VfxPoolCost = {
  drawCalls: 4,
  particles: 1_024,
  shards: 320,
};

export function validateVfxManifest(
  cues: readonly VfxCueManifest[],
): readonly VfxManifestIssue[] {
  const issues: VfxManifestIssue[] = [];
  const ids = new Set<string>();

  for (const cue of cues) {
    if (ids.has(cue.id)) {
      issues.push({ cueId: cue.id, message: "duplicate cue id" });
    }
    ids.add(cue.id);

    if (cue.fallbackCue.trim().length === 0 || cue.fallbackCue === cue.id) {
      issues.push({
        cueId: cue.id,
        message: "cue needs a distinct no-flash/reduced-motion fallback",
      });
    }

    if (Object.values(cue.biomeVariants).some((variant) => variant.trim().length === 0)) {
      issues.push({ cueId: cue.id, message: "all four biome variants are required" });
    }

    if (
      cue.luminanceEnvelope.length === 0 ||
      cue.luminanceEnvelope.some(
        (sample) => !Number.isFinite(sample) || sample < 0 || sample > 1,
      )
    ) {
      issues.push({
        cueId: cue.id,
        message: "luminance envelope samples must be finite values from 0 to 1",
      });
    }

    if (cue.saturatedRed) {
      issues.push({ cueId: cue.id, message: "saturated-red flashes are forbidden" });
    }

    if (cue.tags.some((tag) => FORBIDDEN_GORE_TAGS.has(tag))) {
      issues.push({ cueId: cue.id, message: "blood/gore presentation is forbidden" });
    }

    if (
      cue.poolCost.drawCalls > MAX_POOL_COST.drawCalls ||
      cue.poolCost.particles > MAX_POOL_COST.particles ||
      cue.poolCost.shards > MAX_POOL_COST.shards ||
      cue.poolCost.drawCalls < 0 ||
      cue.poolCost.particles < 0 ||
      cue.poolCost.shards < 0
    ) {
      issues.push({ cueId: cue.id, message: "cue exceeds the global VFX pool budget" });
    }
  }

  for (const cue of cues) {
    if (!ids.has(cue.fallbackCue)) {
      issues.push({ cueId: cue.id, message: `missing fallback cue ${cue.fallbackCue}` });
    }
  }

  return issues;
}

export const crystalDeathCues = [
  {
    id: "thrall_crystal_shatter",
    biomeVariants: {
      grassland: "spore_crystal_shatter",
      house: "violet_crystal_shatter",
      desert: "sand_crystal_shatter",
      hell: "ember_crystal_shatter",
    },
    fallbackCue: "thrall_crystal_dissolve_reduced",
    flashClass: "local_high_contrast",
    luminanceEnvelope: [0.45, 0.7, 0.42, 0.2, 0],
    motionClass: "impact",
    poolCost: { drawCalls: 4, particles: 96, shards: 20 },
    saturatedRed: false,
    tags: ["crystal", "shards", "light_dust"],
  },
  {
    id: "thrall_crystal_dissolve_reduced",
    biomeVariants: {
      grassland: "spore_outline_fade",
      house: "violet_outline_fade",
      desert: "sand_outline_fade",
      hell: "ember_outline_fade",
    },
    fallbackCue: "thrall_crystal_dissolve_static",
    flashClass: "none",
    luminanceEnvelope: [0.25, 0.2, 0.1, 0],
    motionClass: "ambient",
    poolCost: { drawCalls: 1, particles: 16, shards: 0 },
    saturatedRed: false,
    tags: ["crystal", "outline", "light_dust"],
  },
  {
    id: "thrall_crystal_dissolve_static",
    biomeVariants: {
      grassland: "spore_static_outline",
      house: "violet_static_outline",
      desert: "sand_static_outline",
      hell: "ember_static_outline",
    },
    fallbackCue: "thrall_crystal_dissolve_reduced",
    flashClass: "none",
    luminanceEnvelope: [0.2, 0.1, 0],
    motionClass: "none",
    poolCost: { drawCalls: 1, particles: 0, shards: 0 },
    saturatedRed: false,
    tags: ["crystal", "outline", "text_cue"],
  },
] as const satisfies readonly VfxCueManifest[];
