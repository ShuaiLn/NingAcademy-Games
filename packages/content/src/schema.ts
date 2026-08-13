import { z } from "zod";

const strictObject = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.object(shape).strict();

export const CardIdSchema = z.string().regex(/^[SZ]\d{3}$/u);
export const ContentVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/u);
export const SourceCatalogVersionSchema = z.literal("card_catalog_v1_draft");

export const LocalizedTextSchema = strictObject({
  zhCN: z.string().trim().min(1).max(500),
  en: z.string().trim().min(1).max(500),
});

export const FactionSchema = z.enum(["survivor", "zombie"]);
export const RaritySchema = z.enum([
  "white",
  "silver",
  "gold",
  "diamond",
  "black_gold",
]);
export const GameModeSchema = z.enum([
  "solo_pve",
  "coop_pve",
  "asymmetric",
]);
export const BiomeSchema = z.enum(["house", "grass", "desert", "hell"]);
export const ProfessionSchema = z.enum([
  "warrior",
  "medic",
  "mage",
  "assassin",
  "guardian",
  "hunter",
  "summoner",
  "controller",
  "bulwark",
]);
export const WeaponFamilySchema = z.enum([
  "sniper_rifle",
  "submachine_gun",
  "assault_rifle",
  "spear",
  "sword",
  "laser",
  "plasma",
  "grenade",
]);
export const CardTagSchema = z.enum([
  "offense",
  "defense",
  "mobility",
  "utility",
  "weapon",
  "resource",
  "mechanism",
  "death_protection",
  "learning_modifier",
  "spawn",
  "boss",
  "faction_shared",
  "pve_daily_eligible",
]);

export const DayWeightBandSchema = strictObject({
  fromDay: z.number().int().min(1).max(10_000),
  throughDay: z.number().int().min(1).max(10_000).nullable(),
  weight: z.number().finite().positive().max(10_000),
});

export const DrawPolicySchema = strictObject({
  dayWeights: z.array(DayWeightBandSchema).min(1).max(32),
  duplicateWeightDecay: z.enum([
    "none",
    "base_over_one_plus_stacks",
  ]),
  fullStackBehavior: z.enum(["exclude", "replace_existing"]),
}).superRefine((policy, context) => {
  const sorted = [...policy.dayWeights].sort(
    (left, right) => left.fromDay - right.fromDay,
  );

  for (let index = 0; index < sorted.length; index += 1) {
    const band = sorted[index];
    if (band === undefined) {
      continue;
    }
    if (band.throughDay !== null && band.throughDay < band.fromDay) {
      context.addIssue({
        code: "custom",
        message: "throughDay must be greater than or equal to fromDay",
        path: ["dayWeights", index, "throughDay"],
      });
    }

    const nextBand = sorted[index + 1];
    if (
      nextBand !== undefined &&
      (band.throughDay === null || band.throughDay >= nextBand.fromDay)
    ) {
      context.addIssue({
        code: "custom",
        message: "day weight bands must not overlap",
        path: ["dayWeights", index],
      });
    }
  }
});

export const EligibilitySchema = strictObject({
  modes: z.array(GameModeSchema).min(1).max(3),
  biomes: z.array(BiomeSchema).min(1).max(4),
  professions: z.array(ProfessionSchema).max(9),
  weaponFamilies: z.array(WeaponFamilySchema).max(8),
  minDay: z.number().int().min(1).max(10_000),
  maxDay: z.number().int().min(1).max(10_000).nullable(),
  prerequisites: z.array(CardIdSchema).max(32),
  prerequisiteStacks: z
    .array(
      strictObject({
        cardId: CardIdSchema,
        minimumStacks: z.number().int().min(1).max(100),
      }),
    )
    .max(32),
  excludes: z.array(CardIdSchema).max(32),
  rankedPolicy: z.enum(["eligible", "excluded"]),
  assignmentPolicy: z.enum(["allowed", "teacher_opt_in", "forbidden"]),
}).superRefine((eligibility, context) => {
  if (
    eligibility.maxDay !== null &&
    eligibility.maxDay < eligibility.minDay
  ) {
    context.addIssue({
      code: "custom",
      message: "maxDay must be greater than or equal to minDay",
      path: ["maxDay"],
    });
  }
});

export const SurvivorActivationSchema = strictObject({
  kind: z.literal("survivor_card_opportunity"),
  modes: z.array(GameModeSchema).min(1).max(3),
  selection: z.literal("owner_three_choose_one"),
  resolution: z.literal("timed_personal_question"),
  onSuccess: z.literal("apply_atomically"),
  onFailure: z.literal("lose_card_and_take_10_nonlethal_true_damage"),
  scope: z.literal("owner"),
});

export const ZombiePveDailyActivationSchema = strictObject({
  kind: z.literal("zombie_pve_daily"),
  modes: z.array(z.enum(["solo_pve", "coop_pve"])).min(1).max(2),
  selection: z.literal("server_random_legal_card"),
  resolution: z.literal("automatic_success"),
  scope: z.literal("all_mobs_and_player_bodies"),
});

export const ZombieAsymmetricDailyActivationSchema = strictObject({
  kind: z.literal("zombie_asymmetric_daily"),
  modes: z.tuple([z.literal("asymmetric")]),
  selection: z.literal("random_online_zombie_player_three_choose_one"),
  resolution: z.literal("timed_personal_question"),
  onSuccess: z.literal("apply_atomically"),
  onFailure: z.literal("lose_card_and_10_infection_points"),
  scope: z.literal("all_mobs_and_player_bodies"),
});

export const ActivationPolicySchema = z.discriminatedUnion("kind", [
  SurvivorActivationSchema,
  ZombiePveDailyActivationSchema,
  ZombieAsymmetricDailyActivationSchema,
]);

export const ConflictGroupSchema = z.enum([
  "personal_death_protection",
  "team_wipe_protection",
  "primary_weapon_replacement",
  "faction_spawn_mechanism",
]);

export const MechanismSlotSchema = strictObject({
  scope: z.enum(["personal", "team_shared", "zombie_faction_shared"]),
  slots: z.literal(1),
  conflictGroups: z.array(ConflictGroupSchema).max(4),
  replacement: z.literal("choose_replacement_before_question"),
});

export const AcquisitionSchema = strictObject({
  kind: z.enum(["numeric", "mechanism", "weapon", "consumable"]),
  maxStacks: z.number().int().min(1).max(100),
  conflictGroups: z.array(ConflictGroupSchema).max(4),
  mechanismSlot: MechanismSlotSchema.nullable(),
}).superRefine((acquisition, context) => {
  const hasSlot = acquisition.mechanismSlot !== null;
  if (acquisition.kind === "mechanism" && !hasSlot) {
    context.addIssue({
      code: "custom",
      message: "mechanism cards must declare a mechanism slot",
      path: ["mechanismSlot"],
    });
  }
  if (acquisition.kind !== "mechanism" && hasSlot) {
    context.addIssue({
      code: "custom",
      message: "only mechanism cards may declare a mechanism slot",
      path: ["mechanismSlot"],
    });
  }
});

export const RuntimeChargesSchema = strictObject({
  initial: z.number().int().min(0).max(100),
  maximum: z.number().int().min(1).max(100),
  reset: z.enum(["never", "day", "boss_phase", "run"]),
});

export const RuntimeStateSchema = strictObject({
  charges: RuntimeChargesSchema.nullable(),
  maxActiveInstances: z.number().int().min(1).max(100),
  checkpointed: z.literal(true),
});

export const TriggerSchema = z.discriminatedUnion("kind", [
  strictObject({ kind: z.literal("on_acquire") }),
  strictObject({
    kind: z.literal("on_damage_dealt"),
    hitKinds: z.array(z.enum(["normal", "weakpoint", "critical"])).min(1),
  }),
  strictObject({ kind: z.literal("on_damage_taken") }),
  strictObject({ kind: z.literal("on_kill") }),
  strictObject({ kind: z.literal("on_day_start") }),
  strictObject({ kind: z.literal("on_boss_phase_start") }),
  strictObject({
    kind: z.literal("on_interval"),
    intervalMs: z.number().int().min(100).max(3_600_000),
    phase: z.enum(["quota_combat", "boss_combat", "summon_cleanup"]),
  }),
  strictObject({
    kind: z.literal("on_first_matching_event"),
    events: z
      .array(z.enum(["answer_failed", "fatal_damage", "consumable_used"]))
      .min(1)
      .max(3),
    reset: z.literal("run"),
  }),
  strictObject({
    kind: z.literal("on_engine_rule_event"),
    handlerKey: CardIdSchema,
  }),
]);

export const TargetSchema = z.discriminatedUnion("kind", [
  strictObject({ kind: z.literal("self") }),
  strictObject({ kind: z.literal("hit_target") }),
  strictObject({ kind: z.literal("team_all") }),
  strictObject({ kind: z.literal("faction_all_mobs") }),
  strictObject({ kind: z.literal("faction_all_entities") }),
  strictObject({ kind: z.literal("legal_spawn_locations") }),
  strictObject({
    kind: z.literal("area_around_target"),
    radiusMeters: z.number().finite().positive().max(100),
    maxTargets: z.number().int().min(1).max(100),
    requiresLineOfSight: z.boolean(),
  }),
]);

export const EffectCapSchema = z.discriminatedUnion("kind", [
  strictObject({
    kind: z.literal("per_root_event"),
    limit: z.number().int().min(1).max(32),
  }),
  strictObject({
    kind: z.literal("per_second"),
    limit: z.number().finite().positive().max(100_000),
  }),
  strictObject({
    kind: z.literal("per_day"),
    limit: z.number().finite().positive().max(1_000_000),
  }),
  strictObject({
    kind: z.literal("per_run"),
    limit: z.number().int().min(1).max(1_000),
  }),
  strictObject({
    kind: z.literal("stat_total"),
    limit: z.number().finite().positive().max(10_000),
    unit: z.enum(["percent", "hit_points", "meters_per_second"]),
  }),
]);

export const CooldownSchema = strictObject({
  durationMs: z.number().int().min(0).max(86_400_000),
  scope: z.enum(["effect", "card", "owner", "team", "faction"]),
  reset: z.enum(["never", "day", "boss_phase", "run"]),
});

export const SpawnPolicySchema = strictObject({
  budgetSource: z.enum([
    "day_quota",
    "base_day_budget",
    "shared_boss_budget",
    "card_budget",
  ]),
  budgetCharge: z.discriminatedUnion("kind", [
    strictObject({
      kind: z.literal("percentage"),
      percentPerTrigger: z.number().finite().positive().max(100),
      totalPercentCap: z.number().finite().positive().max(100),
    }),
    strictObject({ kind: z.literal("entity_archetype_cost") }),
    strictObject({
      kind: z.literal("free"),
      maximumFreeEntitiesPerTrigger: z.number().int().min(1).max(100),
    }),
  ]),
  countsTowardDayQuota: z.boolean(),
  blocksPhaseTransition: z.boolean(),
  rewardPolicy: z.enum(["none", "reduced", "standard"]),
  infectionReward: z.enum(["none", "anti_farm_limited"]),
  entityCapGroup: z.literal("map_hostile_cap"),
  atEntityCap: z.literal("refuse_without_debt"),
  stopSpawningWhen: z.enum([
    "quota_complete",
    "boss_death",
    "day_end",
    "card_removed",
  ]),
  existingEntitiesWhenStopped: z.enum([
    "despawn_no_reward",
    "remain_and_require_cleanup",
  ]),
});

export const EngineCapabilitySchema = z.enum([
  "combat",
  "weapon",
  "inventory",
  "deployable",
  "ai",
  "navigation",
  "environment",
  "day_flow",
  "boss",
  "boss_budget",
  "rescue",
  "learning",
  "anti_abuse",
  "spawn",
  "presentation",
  "ranked",
]);

export const RuleSafetyDomainSchema = z.enum([
  "learning",
  "ranked",
  "spawn",
  "boss_budget",
  "anti_abuse",
]);

export const BoundedRuleParameterSchema = z.union([
  z.string().trim().min(1).max(500),
  z.number().finite().min(-1_000_000).max(1_000_000),
  z.boolean(),
  z.null(),
  z.array(z.string().trim().min(1).max(100)).max(32),
  z.array(z.number().finite().min(-1_000_000).max(1_000_000)).max(32),
]);

export const EngineRuleImplementationStatusSchema = z.discriminatedUnion(
  "status",
  [
    strictObject({
      status: z.literal("implemented"),
      implementationRef: z.string().regex(/^engine:\/\/[SZ]\d{3}$/u),
    }),
    strictObject({
      status: z.literal("blocked"),
      blockedReason: z.string().trim().min(1).max(500),
    }),
  ],
);

export const EngineRuleOperationSchema = strictObject({
  kind: z.literal("engine_rule"),
  handlerKey: CardIdSchema,
  implementation: EngineRuleImplementationStatusSchema,
  requiredCapabilities: z.array(EngineCapabilitySchema).min(1).max(14),
  safetyDomains: z.array(RuleSafetyDomainSchema).max(5),
  parameters: z.record(z.string().regex(/^[a-z][a-zA-Z0-9]{1,63}$/u), BoundedRuleParameterSchema),
});

export const AntiAbusePolicySchema = strictObject({
  kind: z.enum(["s121_player_body_progress", "z082_effective_heal_tax"]),
  effectiveEventOnly: z.literal(true),
  repeatedTargetDecayPercent: z.tuple([
    z.literal(100),
    z.literal(50),
    z.literal(25),
  ]),
  repeatedTargetResetSeconds: z.literal(30),
  perTargetCooldownSeconds: z.number().int().min(0).max(3_600),
  perTargetPerDayCap: z.number().finite().positive().max(100),
  globalPerDayCap: z.number().finite().positive().max(1_000),
  rejectedSources: z.array(
    z.enum(["shield", "armor", "overheal", "overkill", "friendly", "replayed"]),
  ).min(1).max(6),
});

export const BossBudgetPolicySchema = strictObject({
  kind: z.enum(["z084_soul_cleanup", "z093_shared_boss_budget"]),
  totalHpBudgetMultiplier: z.literal(1),
  totalDamageBudgetMultiplier: z.literal(1),
  sharesMajorSkillToken: z.literal(true),
  blocksPhaseTransitionUntilCleanup: z.boolean(),
  countsTowardDayQuota: z.literal(false),
});

export const NormalizedOverrideSchema = strictObject({
  code: z.enum([
    "bloodless_crystal_presentation",
    "s121_anti_farm",
    "s159_audit_safe_compensation",
    "z082_effective_heal_tax",
    "z084_summon_cleanup",
    "z093_shared_boss_budget",
  ]),
  reason: LocalizedTextSchema,
  normalizedDescription: LocalizedTextSchema,
});

const ModifyStatOperationSchema = strictObject({
  kind: z.literal("modify_stat"),
  stat: z.enum([
    "max_health",
    "max_armor",
    "damage",
    "movement_speed",
    "attack_speed",
    "reload_speed",
    "ads_spread",
    "weapon_sway",
    "cooldown_rate",
    "life_steal",
  ]),
  mode: z.enum(["add_flat", "add_percent", "multiply"]),
  value: z.number().finite().min(-1_000).max(1_000),
  unit: z.enum(["hit_points", "percent", "multiplier"]),
});

const DealDamageOperationSchema = strictObject({
  kind: z.literal("deal_damage"),
  amount: z.number().finite().positive().max(1_000_000),
  unit: z.literal("hit_points"),
  damageType: z.enum([
    "physical",
    "fire",
    "ice",
    "psychic",
    "plasma",
    "true_nonlethal",
  ]),
});

const ApplyStatusOperationSchema = strictObject({
  kind: z.literal("apply_status"),
  status: z.enum([
    "slow",
    "burn",
    "weaken",
    "mark",
    "stun",
    "damage_reduction",
  ]),
  magnitude: z.number().finite().positive().max(1_000),
  magnitudeUnit: z.enum(["percent", "hit_points_per_second"]),
  durationMs: z.number().int().positive().max(300_000),
});

const HealOperationSchema = strictObject({
  kind: z.literal("heal"),
  amount: z.number().finite().positive().max(1_000_000),
  unit: z.enum(["hit_points", "percent_max_health"]),
});

const GrantResourceOperationSchema = strictObject({
  kind: z.literal("grant_resource"),
  resource: z.enum(["armor", "ammunition", "infection", "card_progress"]),
  amount: z.number().finite().positive().max(1_000_000),
  unit: z.enum(["points", "percent_capacity"]),
});

// spawnPolicy is intentionally semantic rather than merely structural: every
// publication path must call validateCatalog/assertValidCatalog, which reports
// a stable SPAWN_POLICY_REQUIRED issue for authoring tools.
const SpawnEntityOperationSchema = strictObject({
  kind: z.literal("spawn_entity"),
  archetype: z.enum([
    "base_thrall",
    "special_thrall",
    "elite_thrall",
    "weakened_boss_summon",
    "budget_wave",
    "revived_thrall",
    "phantom_thrall",
    "calamity_thrall",
    "boss_soul",
    "secondary_boss",
    "extinction_thrall",
    "crystal_anchor",
    "crystal_nest",
  ]),
  count: z.number().int().min(1).max(100),
  spawnPolicy: SpawnPolicySchema.optional(),
});

const UpgradeWeaponOperationSchema = strictObject({
  kind: z.literal("upgrade_weapon"),
  family: WeaponFamilySchema,
  stage: z.number().int().min(1).max(10),
  replacesPreviousStage: z.boolean(),
  retainsChainPassives: z.boolean(),
});

const ModifyLearningOperationSchema = strictObject({
  kind: z.literal("modify_learning"),
  modifier: z.enum([
    "time_limit_multiplier",
    "answer_selection",
    "correctness_override",
    "question_tier",
  ]),
  value: z.number().finite().min(-100).max(100),
  appliesTo: z.enum(["practice_only", "assignment", "ranked"]),
});

export const CausalRewriteOperationSchema = strictObject({
  kind: z.literal("causal_rewrite"),
  immutableOriginalAttempt: z.literal("append_causally_voided"),
  aggregation: z.literal("exclude_original_from_rank_and_assignment"),
  revealCorrectAnswer: z.literal(true),
  replacementQuestion: z.literal("different_question"),
  compensation: z.tuple([
    z.literal("restore_trigger_event_pre_state"),
    z.literal("refund_consumable_if_applicable"),
  ]),
  forbiddenRollback: z.tuple([
    z.literal("positions"),
    z.literal("other_players"),
    z.literal("boss_state"),
    z.literal("day_quota"),
    z.literal("world_state"),
    z.literal("database_history"),
  ]),
  selection: z.literal("first_matching_event_in_server_order"),
});

export const EffectOperationSchema = z.discriminatedUnion("kind", [
  ModifyStatOperationSchema,
  DealDamageOperationSchema,
  ApplyStatusOperationSchema,
  HealOperationSchema,
  GrantResourceOperationSchema,
  SpawnEntityOperationSchema,
  UpgradeWeaponOperationSchema,
  ModifyLearningOperationSchema,
  CausalRewriteOperationSchema,
  EngineRuleOperationSchema,
]);

export const CardEffectSchema = strictObject({
  effectId: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/u),
  trigger: TriggerSchema,
  target: TargetSchema,
  operation: EffectOperationSchema,
  cooldown: CooldownSchema.nullable(),
  caps: z.array(EffectCapSchema).min(1).max(8),
});

export const RankedLearningPolicySchema = z.discriminatedUnion("kind", [
  strictObject({ kind: z.literal("none") }),
  strictObject({
    kind: z.literal("practice_only_modifier"),
  }),
  strictObject({
    kind: z.literal("s159_causal_void_exception"),
    maxUsesPerRun: z.literal(1),
    originalAttempt: z.literal("immutable_causally_voided"),
    aggregation: z.literal("excluded_from_rank_and_assignment"),
  }),
]);

export const CheckpointMetadataSchema = strictObject({
  codecVersion: z.number().int().min(1).max(1_000),
  stateKeys: z
    .array(z.string().regex(/^[a-z][a-zA-Z0-9]{1,63}$/u))
    .max(32),
  restore: z.literal("exact_and_versioned"),
});

export const VisibilityMetadataSchema = strictObject({
  acquisition: z.enum(["owner", "team", "faction", "all_players"]),
  runtimeState: z.enum(["owner", "team", "faction", "all_players", "server_only"]),
  opponentDetail: z.enum(["none", "icon_only", "stacks", "full"]),
});

export const PresentationMetadataSchema = strictObject({
  iconKey: z.string().regex(/^[a-z0-9][a-z0-9/_-]{1,127}$/u),
  vfxFamily: z.enum([
    "none",
    "stat_pulse",
    "crystal_core",
    "psychic_wave",
    "spawn_portal",
    "causal_rewrite",
  ]),
  sfxCue: z.string().regex(/^[a-z0-9][a-z0-9/_-]{1,127}$/u),
  uiCue: z.enum([
    "stack_added",
    "mechanism_armed",
    "mechanism_triggered",
    "faction_card_applied",
    "boss_warning",
  ]),
});

export const AccessibilityMetadataSchema = strictObject({
  nonColorCue: z.enum(["icon", "outline", "caption", "icon_and_caption"]),
  reducedMotionFallback: z.enum([
    "static_icon",
    "opacity_only",
    "single_particle_burst",
  ]),
  flash: z.enum(["none", "localized_capped"]),
  shake: z.enum(["none", "optional_low", "optional_high"]),
  audioCaptionKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,127}$/u),
});

export const CardDefinitionSchema = strictObject({
  id: CardIdSchema,
  faction: FactionSchema,
  contentVersion: ContentVersionSchema,
  revision: z.number().int().min(1).max(1_000_000),
  localization: strictObject({
    name: LocalizedTextSchema,
    description: LocalizedTextSchema,
    englishDescriptionStatus: z.enum(["approved", "blocked_review"]),
  }),
  source: strictObject({
    catalogVersion: SourceCatalogVersionSchema,
    originalNameZhCN: z.string().trim().min(1).max(200),
    originalDescriptionZhCN: z.string().trim().min(1).max(1_000),
    originalLimitZhCN: z.string().trim().min(1).max(500),
  }),
  rarity: RaritySchema,
  tags: z.array(CardTagSchema).min(1).max(16),
  eligibility: EligibilitySchema,
  draw: DrawPolicySchema,
  activationPolicies: z.array(ActivationPolicySchema).min(1).max(3),
  acquisition: AcquisitionSchema,
  runtime: RuntimeStateSchema,
  effects: z.array(CardEffectSchema).min(1).max(32),
  antiAbusePolicy: AntiAbusePolicySchema.nullable(),
  bossBudgetPolicy: BossBudgetPolicySchema.nullable(),
  normalizedOverrides: z.array(NormalizedOverrideSchema).max(8),
  rankedLearningPolicy: RankedLearningPolicySchema,
  checkpoint: CheckpointMetadataSchema,
  visibility: VisibilityMetadataSchema,
  presentation: PresentationMetadataSchema,
  accessibility: AccessibilityMetadataSchema,
});

export const AuthoredCardRecordSchema = strictObject({
  id: CardIdSchema,
  faction: FactionSchema,
  rarity: RaritySchema,
  nameZhCN: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  descriptionZhCN: z.string().trim().min(1).max(1_000),
  descriptionEn: z.string().trim().min(1).max(1_000),
  limitZhCN: z.string().trim().min(1).max(500),
  minDay: z.number().int().min(1).max(10_000),
  prerequisites: z.array(CardIdSchema).max(32),
  maxStacks: z.number().int().min(1).max(100),
  tags: z.array(CardTagSchema).min(1).max(16),
  requiredCapabilities: z.array(EngineCapabilitySchema).min(1).max(14),
  implementation: EngineRuleImplementationStatusSchema,
  safetyDomains: z.array(RuleSafetyDomainSchema).max(5),
  spawnPolicies: z.array(SpawnPolicySchema).max(8),
  antiAbusePolicy: AntiAbusePolicySchema.nullable(),
  bossBudgetPolicy: BossBudgetPolicySchema.nullable(),
  normalizedOverrides: z.array(NormalizedOverrideSchema).max(8),
});

export type CardId = z.infer<typeof CardIdSchema>;
export type CardDefinition = z.infer<typeof CardDefinitionSchema>;
export type CardEffect = z.infer<typeof CardEffectSchema>;
export type SpawnPolicy = z.infer<typeof SpawnPolicySchema>;
export type AuthoredCardRecord = z.infer<typeof AuthoredCardRecordSchema>;
