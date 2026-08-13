import { describe, expect, it } from "vitest";

import {
  CatalogIssueCode,
  CardDefinitionSchema,
  REPRESENTATIVE_CARD_CATALOG,
  validateCatalog,
} from "../src/index.js";

const cloneCatalog = (): Record<string, unknown>[] =>
  structuredClone(REPRESENTATIVE_CARD_CATALOG) as unknown as Record<
    string,
    unknown
  >[];

const expectIssue = (
  catalog: readonly unknown[],
  code: (typeof CatalogIssueCode)[keyof typeof CatalogIssueCode],
): void => {
  const result = validateCatalog(catalog);
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.issues.some((issue) => issue.code === code)).toBe(true);
  }
};

const requireCard = (
  catalog: readonly Record<string, unknown>[],
  index: number,
): Record<string, unknown> => {
  const card = catalog[index];
  if (card === undefined) {
    throw new Error(`Expected representative card at index ${index}`);
  }
  return card;
};

describe("representative card catalog", () => {
  it("validates survivor, automatic PvE zombie, asymmetric zombie, and S159 policies", () => {
    const result = validateCatalog(REPRESENTATIVE_CARD_CATALOG);

    expect(result.success).toBe(true);
    expect(result.cards).toHaveLength(4);

    const zombieCard = result.cards.find((card) => card.id === "Z001");
    expect(
      zombieCard?.activationPolicies.some(
        (policy) =>
          policy.kind === "zombie_pve_daily" &&
          policy.resolution === "automatic_success",
      ),
    ).toBe(true);
    expect(
      zombieCard?.activationPolicies.some(
        (policy) => policy.kind === "zombie_asymmetric_daily",
      ),
    ).toBe(true);

    const causalRewrite = result.cards.find((card) => card.id === "S159");
    expect(causalRewrite?.rankedLearningPolicy.kind).toBe(
      "s159_causal_void_exception",
    );
  });

  it("rejects unknown fields at every strict schema boundary", () => {
    const firstCard = requireCard(cloneCatalog(), 0);
    const parsed = CardDefinitionSchema.safeParse({
      ...firstCard,
      arbitraryRuntimeCode: "not allowed",
    });

    expect(parsed.success).toBe(false);
  });

  it("reports duplicate stable IDs", () => {
    const catalog = cloneCatalog();
    const duplicate = structuredClone(requireCard(catalog, 0));
    catalog.push(duplicate);

    expectIssue(catalog, CatalogIssueCode.DUPLICATE_CARD_ID);
  });

  it("reports missing prerequisites", () => {
    const catalog = cloneCatalog();
    const firstCard = requireCard(catalog, 0);
    const eligibility = firstCard.eligibility as Record<string, unknown>;
    eligibility.prerequisites = ["S999"];

    expectIssue(catalog, CatalogIssueCode.MISSING_PREREQUISITE);
  });

  it("reports prerequisite cycles", () => {
    const catalog = cloneCatalog();
    const first = requireCard(catalog, 0);
    const second = requireCard(catalog, 1);
    (first.eligibility as Record<string, unknown>).prerequisites = ["S159"];
    (second.eligibility as Record<string, unknown>).prerequisites = ["S001"];

    expectIssue(catalog, CatalogIssueCode.PREREQUISITE_CYCLE);
  });

  it("rejects generic learning outcome modifiers in ranked cards", () => {
    const catalog = cloneCatalog();
    const firstCard = requireCard(catalog, 0);
    const effects = firstCard.effects as Record<string, unknown>[];
    effects.push({
      effectId: "illegal_ranked_answer_override",
      trigger: { kind: "on_acquire" },
      target: { kind: "self" },
      operation: {
        kind: "modify_learning",
        modifier: "correctness_override",
        value: 1,
        appliesTo: "ranked",
      },
      cooldown: null,
      caps: [{ kind: "per_run", limit: 1 }],
    });

    expectIssue(catalog, CatalogIssueCode.INVALID_RANKED_LEARNING_MODIFIER);
  });

  it("requires budget, quota, reward, cap, and cleanup policy for spawns", () => {
    const catalog = cloneCatalog();
    const spawnCard = catalog.find((card) => card.id === "Z095");
    if (spawnCard === undefined) {
      throw new Error("Expected Z095 representative card");
    }
    const effects = spawnCard.effects as Record<string, unknown>[];
    const effect = effects[0];
    if (effect === undefined) {
      throw new Error("Expected Z095 spawn effect");
    }
    const operation = effect.operation as Record<string, unknown>;
    delete operation.spawnPolicy;

    expectIssue(catalog, CatalogIssueCode.SPAWN_POLICY_REQUIRED);
  });

  it("does not allow another card to impersonate the S159 ranked exception", () => {
    const catalog = cloneCatalog();
    const causalCard = requireCard(catalog, 1);
    causalCard.id = "S158";

    expectIssue(catalog, CatalogIssueCode.INVALID_CAUSAL_REWRITE_POLICY);
  });
});
