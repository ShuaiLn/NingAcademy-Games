import type { z } from "zod";

import {
  CardDefinitionSchema,
  type CardDefinition,
  type CardId,
} from "./schema.js";

export const CatalogIssueCode = {
  SCHEMA_INVALID: "SCHEMA_INVALID",
  DUPLICATE_CARD_ID: "DUPLICATE_CARD_ID",
  DUPLICATE_EFFECT_ID: "DUPLICATE_EFFECT_ID",
  FACTION_ID_MISMATCH: "FACTION_ID_MISMATCH",
  MISSING_PREREQUISITE: "MISSING_PREREQUISITE",
  PREREQUISITE_CYCLE: "PREREQUISITE_CYCLE",
  CROSS_FACTION_PREREQUISITE: "CROSS_FACTION_PREREQUISITE",
  INVALID_RANKED_LEARNING_MODIFIER: "INVALID_RANKED_LEARNING_MODIFIER",
  INVALID_CAUSAL_REWRITE_POLICY: "INVALID_CAUSAL_REWRITE_POLICY",
  SPAWN_POLICY_REQUIRED: "SPAWN_POLICY_REQUIRED",
  INVALID_ACTIVATION_POLICY: "INVALID_ACTIVATION_POLICY",
  INVALID_FACTION_SCOPE: "INVALID_FACTION_SCOPE",
  ENGINE_RULE_HANDLER_MISMATCH: "ENGINE_RULE_HANDLER_MISMATCH",
  ENGINE_RULE_POLICY_BYPASS: "ENGINE_RULE_POLICY_BYPASS",
  BLOCKED_ENGINE_RULE: "BLOCKED_ENGINE_RULE",
  BLOCKED_LOCALIZATION: "BLOCKED_LOCALIZATION",
  REQUIRED_NORMALIZED_OVERRIDE: "REQUIRED_NORMALIZED_OVERRIDE",
  REQUIRED_ANTI_ABUSE_POLICY: "REQUIRED_ANTI_ABUSE_POLICY",
  REQUIRED_BOSS_BUDGET_POLICY: "REQUIRED_BOSS_BUDGET_POLICY",
} as const;

export type CatalogIssueCode =
  (typeof CatalogIssueCode)[keyof typeof CatalogIssueCode];

export interface CatalogIssue {
  readonly code: CatalogIssueCode;
  readonly message: string;
  readonly cardId?: string;
  readonly path?: string;
}

export type CatalogValidationResult =
  | {
      readonly success: true;
      readonly cards: readonly CardDefinition[];
      readonly issues: readonly [];
    }
  | {
      readonly success: false;
      readonly cards: readonly CardDefinition[];
      readonly issues: readonly CatalogIssue[];
    };

export interface ReleaseValidationOptions {
  readonly requireImplementedEngineRules?: boolean;
  readonly requireApprovedLocalization?: boolean;
}

export class CatalogValidationError extends Error {
  public readonly issues: readonly CatalogIssue[];

  public constructor(issues: readonly CatalogIssue[]) {
    super(
      `Card catalog validation failed:\n${issues
        .map((issue) => `- [${issue.code}] ${issue.message}`)
        .join("\n")}`,
    );
    this.name = "CatalogValidationError";
    this.issues = issues;
  }
}

const formatZodPath = (path: z.core.$ZodIssue["path"]): string =>
  path.map(String).join(".");

const getRawCardId = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return undefined;
  }
  return typeof value.id === "string" ? value.id : undefined;
};

const detectCycles = (
  cardsById: ReadonlyMap<CardId, CardDefinition>,
): readonly CatalogIssue[] => {
  const visiting = new Set<CardId>();
  const visited = new Set<CardId>();
  const stack: CardId[] = [];
  const reported = new Set<string>();
  const issues: CatalogIssue[] = [];

  const visit = (id: CardId): void => {
    if (visited.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(cycleStart), id];
      const key = [...new Set(cycle)].sort().join("|");
      if (!reported.has(key)) {
        reported.add(key);
        issues.push({
          code: CatalogIssueCode.PREREQUISITE_CYCLE,
          cardId: id,
          message: `Prerequisite cycle detected: ${cycle.join(" -> ")}`,
          path: "eligibility.prerequisites",
        });
      }
      return;
    }

    const card = cardsById.get(id);
    if (card === undefined) {
      return;
    }
    visiting.add(id);
    stack.push(id);
    for (const prerequisite of card.eligibility.prerequisites) {
      if (cardsById.has(prerequisite)) {
        visit(prerequisite);
      }
    }
    stack.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of cardsById.keys()) {
    visit(id);
  }
  return issues;
};

const validateCardSemantics = (
  card: CardDefinition,
  cardsById: ReadonlyMap<CardId, CardDefinition>,
): readonly CatalogIssue[] => {
  const issues: CatalogIssue[] = [];
  const expectedPrefix = card.faction === "survivor" ? "S" : "Z";
  if (!card.id.startsWith(expectedPrefix)) {
    issues.push({
      code: CatalogIssueCode.FACTION_ID_MISMATCH,
      cardId: card.id,
      message: `${card.id} does not match faction ${card.faction}`,
      path: "faction",
    });
  }

  const effectIds = new Set<string>();
    for (const [effectIndex, effect] of card.effects.entries()) {
    if (effectIds.has(effect.effectId)) {
      issues.push({
        code: CatalogIssueCode.DUPLICATE_EFFECT_ID,
        cardId: card.id,
        message: `${card.id} repeats effectId ${effect.effectId}`,
        path: `effects.${effectIndex}.effectId`,
      });
    }
    effectIds.add(effect.effectId);

    if (
      effect.operation.kind === "spawn_entity" &&
      effect.operation.spawnPolicy === undefined
    ) {
      issues.push({
        code: CatalogIssueCode.SPAWN_POLICY_REQUIRED,
        cardId: card.id,
        message: `${card.id}/${effect.effectId} spawns gameplay entities without a spawn policy`,
        path: `effects.${effectIndex}.operation.spawnPolicy`,
      });
    }

    if (
      effect.operation.kind === "modify_learning" &&
      card.eligibility.rankedPolicy === "eligible"
    ) {
      issues.push({
        code: CatalogIssueCode.INVALID_RANKED_LEARNING_MODIFIER,
        cardId: card.id,
        message: `${card.id} modifies learning outcomes but is eligible for ranked play`,
        path: `effects.${effectIndex}.operation`,
      });
    }

      if (effect.operation.kind === "engine_rule") {
      if (effect.operation.handlerKey !== card.id) {
        issues.push({
          code: CatalogIssueCode.ENGINE_RULE_HANDLER_MISMATCH,
          cardId: card.id,
          message: `${card.id} may only invoke its own stable-ID engine handler`,
          path: `effects.${effectIndex}.operation.handlerKey`,
        });
      }
      if (
        effect.trigger.kind === "on_engine_rule_event" &&
        effect.trigger.handlerKey !== card.id
      ) {
        issues.push({
          code: CatalogIssueCode.ENGINE_RULE_HANDLER_MISMATCH,
          cardId: card.id,
          message: `${card.id} may only subscribe to its own engine rule events`,
          path: `effects.${effectIndex}.trigger.handlerKey`,
        });
      }

      const guardedCapabilityDomains = [
        ["learning", "learning"],
        ["ranked", "ranked"],
        ["spawn", "spawn"],
        ["boss_budget", "boss_budget"],
        ["anti_abuse", "anti_abuse"],
      ] as const;
      for (const [capability, domain] of guardedCapabilityDomains) {
        if (
          effect.operation.requiredCapabilities.includes(capability) &&
          !effect.operation.safetyDomains.includes(domain)
        ) {
          issues.push({
            code: CatalogIssueCode.ENGINE_RULE_POLICY_BYPASS,
            cardId: card.id,
            message: `${card.id}/${effect.effectId} requires ${domain} but omits its guarded safety domain`,
            path: `effects.${effectIndex}.operation.safetyDomains`,
          });
        }
      }

      if (
        effect.operation.safetyDomains.includes("spawn") &&
        !card.effects.some(
          (candidate) =>
            candidate.operation.kind === "spawn_entity" &&
            candidate.operation.spawnPolicy !== undefined,
        )
      ) {
        issues.push({
          code: CatalogIssueCode.ENGINE_RULE_POLICY_BYPASS,
          cardId: card.id,
          message: `${card.id} spawn engine rule must be paired with a spawn_entity operation and explicit spawn policy`,
          path: `effects.${effectIndex}.operation`,
        });
      }
    }
  }


  const overrideCodes = new Set(
    card.normalizedOverrides.map((override) => override.code),
  );
  const requiredOverride:
    | (typeof card.normalizedOverrides)[number]["code"]
    | undefined = ({
    S121: "s121_anti_farm",
    S159: "s159_audit_safe_compensation",
    Z082: "z082_effective_heal_tax",
    Z084: "z084_summon_cleanup",
    Z093: "z093_shared_boss_budget",
  } as const)[card.id as "S121" | "S159" | "Z082" | "Z084" | "Z093"];
  if (requiredOverride !== undefined && !overrideCodes.has(requiredOverride)) {
    issues.push({
      code: CatalogIssueCode.REQUIRED_NORMALIZED_OVERRIDE,
      cardId: card.id,
      message: `${card.id} must declare normalized override ${requiredOverride}`,
      path: "normalizedOverrides",
    });
  }
  if (
    card.faction === "zombie" &&
    !overrideCodes.has("bloodless_crystal_presentation")
  ) {
    issues.push({
      code: CatalogIssueCode.REQUIRED_NORMALIZED_OVERRIDE,
      cardId: card.id,
      message: `${card.id} must declare the bloodless crystal presentation override`,
      path: "normalizedOverrides",
    });
  }
  if (
    (card.id === "S121" || card.id === "Z082") &&
    card.antiAbusePolicy === null
  ) {
    issues.push({
      code: CatalogIssueCode.REQUIRED_ANTI_ABUSE_POLICY,
      cardId: card.id,
      message: `${card.id} must declare its anti-abuse policy`,
      path: "antiAbusePolicy",
    });
  }
  if (
    card.effects.some(
      (effect) =>
        effect.operation.kind === "engine_rule" &&
        effect.operation.safetyDomains.includes("learning"),
    ) &&
    card.rankedLearningPolicy.kind === "none"
  ) {
    issues.push({
      code: CatalogIssueCode.ENGINE_RULE_POLICY_BYPASS,
      cardId: card.id,
      message: `${card.id} learning engine rule must declare a ranked learning policy`,
      path: "rankedLearningPolicy",
    });
  }
  if (
    card.effects.some(
      (effect) =>
        effect.operation.kind === "engine_rule" &&
        effect.operation.safetyDomains.includes("anti_abuse"),
    ) &&
    card.antiAbusePolicy === null
  ) {
    issues.push({
      code: CatalogIssueCode.ENGINE_RULE_POLICY_BYPASS,
      cardId: card.id,
      message: `${card.id} anti-abuse engine rule must declare an anti-abuse policy`,
      path: "antiAbusePolicy",
    });
  }
  if (
    card.effects.some(
      (effect) =>
        effect.operation.kind === "engine_rule" &&
        effect.operation.safetyDomains.includes("boss_budget"),
    ) &&
    card.bossBudgetPolicy === null
  ) {
    issues.push({
      code: CatalogIssueCode.ENGINE_RULE_POLICY_BYPASS,
      cardId: card.id,
      message: `${card.id} Boss-budget engine rule must declare a Boss budget policy`,
      path: "bossBudgetPolicy",
    });
  }
  if (
    (card.id === "Z084" || card.id === "Z093") &&
    card.bossBudgetPolicy === null
  ) {
    issues.push({
      code: CatalogIssueCode.REQUIRED_BOSS_BUDGET_POLICY,
      cardId: card.id,
      message: `${card.id} must declare its shared Boss budget/cleanup policy`,
      path: "bossBudgetPolicy",
    });
  }

  for (const prerequisiteId of card.eligibility.prerequisites) {
    const prerequisite = cardsById.get(prerequisiteId);
    if (prerequisite === undefined) {
      issues.push({
        code: CatalogIssueCode.MISSING_PREREQUISITE,
        cardId: card.id,
        message: `${card.id} requires missing card ${prerequisiteId}`,
        path: "eligibility.prerequisites",
      });
    } else if (prerequisite.faction !== card.faction) {
      issues.push({
        code: CatalogIssueCode.CROSS_FACTION_PREREQUISITE,
        cardId: card.id,
        message: `${card.id} cannot require ${prerequisiteId} from another faction`,
        path: "eligibility.prerequisites",
      });
    }
  }

  const stackPrerequisiteIds = new Set(
    card.eligibility.prerequisiteStacks.map((entry) => entry.cardId),
  );
  const prerequisiteIds = new Set(card.eligibility.prerequisites);
  if (
    stackPrerequisiteIds.size !== prerequisiteIds.size ||
    [...prerequisiteIds].some((id) => !stackPrerequisiteIds.has(id))
  ) {
    issues.push({
      code: CatalogIssueCode.SCHEMA_INVALID,
      cardId: card.id,
      message:
        "prerequisites and prerequisiteStacks must name the same stable card IDs",
      path: "eligibility.prerequisiteStacks",
    });
  }

  const survivorActivation = card.activationPolicies.some(
    (policy) => policy.kind === "survivor_card_opportunity",
  );
  const zombieActivation = card.activationPolicies.some(
    (policy) =>
      policy.kind === "zombie_pve_daily" ||
      policy.kind === "zombie_asymmetric_daily",
  );
  if (
    (card.faction === "survivor" && (!survivorActivation || zombieActivation)) ||
    (card.faction === "zombie" && (survivorActivation || !zombieActivation))
  ) {
    issues.push({
      code: CatalogIssueCode.INVALID_ACTIVATION_POLICY,
      cardId: card.id,
      message: `${card.id} activation policies do not match faction ${card.faction}`,
      path: "activationPolicies",
    });
  }
  if (
    card.faction === "zombie" &&
    card.effects.some((effect) => effect.target.kind === "self")
  ) {
    issues.push({
      code: CatalogIssueCode.INVALID_FACTION_SCOPE,
      cardId: card.id,
      message: `${card.id} is faction-shared and may not target only the selecting player`,
      path: "effects",
    });
  }

  const causalEffects = card.effects.filter(
    (effect) => effect.operation.kind === "causal_rewrite",
  );
  const isExactS159Policy =
    card.id === "S159" &&
    causalEffects.length === 1 &&
    card.rankedLearningPolicy.kind === "s159_causal_void_exception";
  if (
    (causalEffects.length > 0 ||
      card.rankedLearningPolicy.kind === "s159_causal_void_exception") &&
    !isExactS159Policy
  ) {
    issues.push({
      code: CatalogIssueCode.INVALID_CAUSAL_REWRITE_POLICY,
      cardId: card.id,
      message:
        "Causal rewrite is reserved for S159 with immutable causally-voided history",
      path: "rankedLearningPolicy",
    });
  }

  return issues;
};

export const validateCatalog = (
  input: readonly unknown[],
): CatalogValidationResult => {
  const issues: CatalogIssue[] = [];
  const parsedCards: CardDefinition[] = [];
  const rawIds = new Map<string, number>();

  input.forEach((value, index) => {
    const rawId = getRawCardId(value);
    if (rawId !== undefined) {
      const existingIndex = rawIds.get(rawId);
      if (existingIndex !== undefined) {
        issues.push({
          code: CatalogIssueCode.DUPLICATE_CARD_ID,
          cardId: rawId,
          message: `${rawId} is duplicated at catalog indexes ${existingIndex} and ${index}`,
          path: `${index}.id`,
        });
      } else {
        rawIds.set(rawId, index);
      }
    }

    const parsed = CardDefinitionSchema.safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          code: CatalogIssueCode.SCHEMA_INVALID,
          ...(rawId === undefined ? {} : { cardId: rawId }),
          message: issue.message,
          path: `${index}.${formatZodPath(issue.path)}`,
        });
      }
      return;
    }
    parsedCards.push(parsed.data);
  });

  const cardsById = new Map<CardId, CardDefinition>();
  for (const card of parsedCards) {
    if (!cardsById.has(card.id)) {
      cardsById.set(card.id, card);
    }
  }
  for (const card of parsedCards) {
    issues.push(...validateCardSemantics(card, cardsById));
  }
  issues.push(...detectCycles(cardsById));

  if (issues.length > 0) {
    return { success: false, cards: parsedCards, issues };
  }
  return { success: true, cards: parsedCards, issues: [] };
};

export const assertValidCatalog = (
  input: readonly unknown[],
): readonly CardDefinition[] => {
  const result = validateCatalog(input);
  if (!result.success) {
    throw new CatalogValidationError(result.issues);
  }
  return Object.freeze(result.cards);
};

export const validateReleaseCatalog = (
  input: readonly unknown[],
  options: ReleaseValidationOptions = { requireImplementedEngineRules: true },
): CatalogValidationResult => {
  const result = validateCatalog(input);
  const issues = result.success ? [] : [...result.issues];

  for (const card of result.cards) {
    if (
      options.requireApprovedLocalization !== false &&
      card.localization.englishDescriptionStatus === "blocked_review"
    ) {
      issues.push({
        code: CatalogIssueCode.BLOCKED_LOCALIZATION,
        cardId: card.id,
        message: `${card.id} English description awaits human localization review`,
        path: "localization.englishDescriptionStatus",
      });
    }
    if (options.requireImplementedEngineRules !== false) {
      card.effects.forEach((effect, effectIndex) => {
        if (
          effect.operation.kind === "engine_rule" &&
          effect.operation.implementation.status === "blocked"
        ) {
          issues.push({
            code: CatalogIssueCode.BLOCKED_ENGINE_RULE,
            cardId: card.id,
            message: `${card.id}/${effect.effectId} requires unimplemented capabilities: ${effect.operation.requiredCapabilities.join(", ")}`,
            path: `effects.${effectIndex}.operation.implementation.status`,
          });
        }
      });
    }
  }

  return issues.length === 0
    ? { success: true, cards: result.cards, issues: [] }
    : { success: false, cards: result.cards, issues };
};
