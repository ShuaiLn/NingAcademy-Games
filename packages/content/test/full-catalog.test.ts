import { describe, expect, it } from "vitest";

import {
  AUTHORED_CARD_RECORDS,
  CatalogIssueCode,
  FULL_CARD_CATALOG,
  RAW_CARD_CATALOG,
  SURVIVOR_CARD_CATALOG,
  ZOMBIE_CARD_CATALOG,
  validateCatalog,
  validateReleaseCatalog,
} from "../src/index.js";

const stableIds = (prefix: "S" | "Z", count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) => `${prefix}${String(index + 1).padStart(3, "0")}`,
  );

const cloneFullCatalog = (): Record<string, unknown>[] =>
  structuredClone(FULL_CARD_CATALOG) as unknown as Record<string, unknown>[];

describe("full card catalog", () => {
  it("faithfully transcribes all 260 stable cards with continuous IDs", () => {
    expect(RAW_CARD_CATALOG).toHaveLength(260);
    expect(AUTHORED_CARD_RECORDS).toHaveLength(260);
    expect(FULL_CARD_CATALOG).toHaveLength(260);
    expect(SURVIVOR_CARD_CATALOG.map((card) => card.id)).toEqual(
      stableIds("S", 160),
    );
    expect(ZOMBIE_CARD_CATALOG.map((card) => card.id)).toEqual(
      stableIds("Z", 100),
    );
  });

  it("preserves the exact draft rarity distribution", () => {
    const totals = Object.fromEntries(
      ["white", "silver", "gold", "diamond", "black_gold"].map((rarity) => [
        rarity,
        FULL_CARD_CATALOG.filter((card) => card.rarity === rarity).length,
      ]),
    );

    expect(totals).toEqual({
      white: 78,
      silver: 65,
      gold: 52,
      diamond: 39,
      black_gold: 26,
    });
  });

  it("keeps explicit prerequisites, stack requirements, and an acyclic graph", () => {
    const s044 = FULL_CARD_CATALOG.find((card) => card.id === "S044");
    expect(s044?.eligibility.prerequisiteStacks).toEqual([
      { cardId: "S024", minimumStacks: 2 },
    ]);
    expect(validateCatalog(FULL_CARD_CATALOG)).toMatchObject({ success: true });
  });

  it("normalizes every zombie card to bloodless crystalline presentation", () => {
    for (const card of ZOMBIE_CARD_CATALOG) {
      expect(
        card.normalizedOverrides.some(
          (override) => override.code === "bloodless_crystal_presentation",
        ),
      ).toBe(true);
    }

    expect(FULL_CARD_CATALOG.find((card) => card.id === "Z001")?.localization.name.zhCN).toBe(
      "晶壳增生",
    );
    expect(FULL_CARD_CATALOG.find((card) => card.id === "Z077")?.localization.name.zhCN).toBe(
      "赤晶雾",
    );
    expect(
      ZOMBIE_CARD_CATALOG.every(
        (card) =>
          !/[血肉尸骨]/u.test(
            `${card.localization.name.zhCN} ${card.localization.description.zhCN}`,
          ),
      ),
    ).toBe(true);
  });

  it("enforces locked anti-abuse, causal audit, summon cleanup, and shared budget overrides", () => {
    const byId = (id: string) => FULL_CARD_CATALOG.find((card) => card.id === id);

    expect(byId("S121")?.antiAbusePolicy).toMatchObject({
      kind: "s121_player_body_progress",
      perTargetPerDayCap: 1,
    });
    expect(byId("Z082")?.antiAbusePolicy).toMatchObject({
      kind: "z082_effective_heal_tax",
      perTargetCooldownSeconds: 60,
      perTargetPerDayCap: 3,
    });
    expect(byId("Z084")?.bossBudgetPolicy).toMatchObject({
      kind: "z084_soul_cleanup",
      blocksPhaseTransitionUntilCleanup: true,
    });
    expect(byId("Z093")?.bossBudgetPolicy).toMatchObject({
      kind: "z093_shared_boss_budget",
      totalHpBudgetMultiplier: 1,
      totalDamageBudgetMultiplier: 1,
      sharesMajorSkillToken: true,
    });

    const s159 = byId("S159");
    const causalOperation = s159?.effects.find(
      (effect) => effect.operation.kind === "causal_rewrite",
    )?.operation;
    expect(causalOperation).toMatchObject({
      kind: "causal_rewrite",
      immutableOriginalAttempt: "append_causally_voided",
      aggregation: "exclude_original_from_rank_and_assignment",
    });
  });

  it("applies every zombie card to the full faction and carries both daily activation paths", () => {
    for (const card of ZOMBIE_CARD_CATALOG) {
      expect(
        card.effects.every(
          (effect) =>
            effect.target.kind === "faction_all_entities" ||
            effect.target.kind === "legal_spawn_locations",
        ),
      ).toBe(true);
      expect(
        card.activationPolicies.some(
          (policy) =>
            policy.kind === "zombie_pve_daily" &&
            policy.resolution === "automatic_success",
        ),
      ).toBe(true);
      expect(
        card.activationPolicies.some(
          (policy) => policy.kind === "zombie_asymmetric_daily",
        ),
      ).toBe(true);
    }
  });

  it("marks every non-implemented stable handler as blocked and fails release validation", () => {
    const result = validateReleaseCatalog(FULL_CARD_CATALOG, {
      requireApprovedLocalization: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.issues.filter(
          (issue) => issue.code === CatalogIssueCode.BLOCKED_ENGINE_RULE,
        ),
      ).toHaveLength(256);
    }
  });

  it("prevents a stable handler from calling another card handler", () => {
    const catalog = cloneFullCatalog();
    const card = catalog.find((entry) => entry.id === "S001");
    if (card === undefined) throw new Error("Expected S001");
    const [effect] = card.effects as Record<string, unknown>[];
    if (effect === undefined) throw new Error("Expected S001 effect");
    const operation = effect.operation as Record<string, unknown>;
    operation.handlerKey = "S002";

    const result = validateCatalog(catalog);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.issues.some(
          (issue) => issue.code === CatalogIssueCode.ENGINE_RULE_HANDLER_MISMATCH,
        ),
      ).toBe(true);
    }
  });

  it("prevents engine rules from bypassing spawn and anti-abuse policies", () => {
    const catalog = cloneFullCatalog();
    const z082 = catalog.find((entry) => entry.id === "Z082");
    if (z082 === undefined) throw new Error("Expected Z082");
    z082.antiAbusePolicy = null;

    const result = validateCatalog(catalog);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.issues.some(
          (issue) => issue.code === CatalogIssueCode.ENGINE_RULE_POLICY_BYPASS,
        ),
      ).toBe(true);
    }
  });

  it("blocks public release while English descriptions await human review", () => {
    expect(
      FULL_CARD_CATALOG.every(
        (card) => card.localization.englishDescriptionStatus === "blocked_review",
      ),
    ).toBe(true);
  });
});
