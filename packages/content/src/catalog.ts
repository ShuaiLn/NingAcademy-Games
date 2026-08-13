import { assertValidCatalog } from "./validation.js";

const allBiomes = ["house", "grass", "desert", "hell"] as const;
const allModes = ["solo_pve", "coop_pve", "asymmetric"] as const;

const survivorActivation = {
  kind: "survivor_card_opportunity",
  modes: allModes,
  selection: "owner_three_choose_one",
  resolution: "timed_personal_question",
  onSuccess: "apply_atomically",
  onFailure: "lose_card_and_take_10_nonlethal_true_damage",
  scope: "owner",
} as const;

const zombieActivationPolicies = [
  {
    kind: "zombie_pve_daily",
    modes: ["solo_pve", "coop_pve"],
    selection: "server_random_legal_card",
    resolution: "automatic_success",
    scope: "all_mobs_and_player_bodies",
  },
  {
    kind: "zombie_asymmetric_daily",
    modes: ["asymmetric"],
    selection: "random_online_zombie_player_three_choose_one",
    resolution: "timed_personal_question",
    onSuccess: "apply_atomically",
    onFailure: "lose_card_and_10_infection_points",
    scope: "all_mobs_and_player_bodies",
  },
] as const;

const rawRepresentativeCatalog = [
  {
    id: "S001",
    faction: "survivor",
    contentVersion: "1.0.0",
    revision: 1,
    localization: {
      name: { zhCN: "稳固瞄准", en: "Steady Aim" },
      description: {
        zhCN: "ADS 散布与武器晃动各降低 10%。",
        en: "Reduces ADS spread and weapon sway by 10% each.",
      },
      englishDescriptionStatus: "approved",
    },
    source: {
      catalogVersion: "card_catalog_v1_draft",
      originalNameZhCN: "稳固瞄准",
      originalDescriptionZhCN: "ADS 散布与武器晃动各降低 10%。",
      originalLimitZhCN: "3 层",
    },
    rarity: "white",
    tags: ["weapon", "utility"],
    eligibility: {
      modes: allModes,
      biomes: allBiomes,
      professions: [],
      weaponFamilies: [],
      minDay: 1,
      maxDay: null,
      prerequisites: [],
      prerequisiteStacks: [],
      excludes: [],
      rankedPolicy: "eligible",
      assignmentPolicy: "allowed",
    },
    draw: {
      dayWeights: [{ fromDay: 1, throughDay: null, weight: 100 }],
      duplicateWeightDecay: "base_over_one_plus_stacks",
      fullStackBehavior: "exclude",
    },
    activationPolicies: [survivorActivation],
    acquisition: {
      kind: "numeric",
      maxStacks: 3,
      conflictGroups: [],
      mechanismSlot: null,
    },
    runtime: { charges: null, maxActiveInstances: 1, checkpointed: true },
    effects: [
      {
        effectId: "reduce_ads_spread",
        trigger: { kind: "on_acquire" },
        target: { kind: "self" },
        operation: {
          kind: "modify_stat",
          stat: "ads_spread",
          mode: "add_percent",
          value: -10,
          unit: "percent",
        },
        cooldown: null,
        caps: [{ kind: "stat_total", limit: 30, unit: "percent" }],
      },
      {
        effectId: "reduce_weapon_sway",
        trigger: { kind: "on_acquire" },
        target: { kind: "self" },
        operation: {
          kind: "modify_stat",
          stat: "weapon_sway",
          mode: "add_percent",
          value: -10,
          unit: "percent",
        },
        cooldown: null,
        caps: [{ kind: "stat_total", limit: 30, unit: "percent" }],
      },
    ],
    antiAbusePolicy: null,
    bossBudgetPolicy: null,
    normalizedOverrides: [],
    rankedLearningPolicy: { kind: "none" },
    checkpoint: {
      codecVersion: 1,
      stateKeys: ["stacks"],
      restore: "exact_and_versioned",
    },
    visibility: {
      acquisition: "owner",
      runtimeState: "owner",
      opponentDetail: "none",
    },
    presentation: {
      iconKey: "cards/s001-steady-aim",
      vfxFamily: "stat_pulse",
      sfxCue: "cards/stat-up",
      uiCue: "stack_added",
    },
    accessibility: {
      nonColorCue: "icon",
      reducedMotionFallback: "static_icon",
      flash: "none",
      shake: "none",
      audioCaptionKey: "card.steady_aim.applied",
    },
  },
  {
    id: "S159",
    faction: "survivor",
    contentVersion: "1.0.0",
    revision: 1,
    localization: {
      name: { zhCN: "因果改写", en: "Causal Rewrite" },
      description: {
        zhCN:
          "每局一次，补偿服务器顺序中最先发生的答错、致命伤害或消耗品使用；原始答题记录保留并标记为因果作废。",
        en: "Once per run, compensates the first server-ordered wrong answer, fatal damage, or consumable use while retaining a causally-voided audit record.",
      },
      englishDescriptionStatus: "approved",
    },
    source: {
      catalogVersion: "card_catalog_v1_draft",
      originalNameZhCN: "因果改写",
      originalDescriptionZhCN:
        "每局可把一次答错、致命伤害或消耗品使用回滚到发生前2秒；服务器自动选择最先发生者。",
      originalLimitZhCN: "每局一次",
    },
    rarity: "black_gold",
    tags: ["mechanism", "learning_modifier", "death_protection"],
    eligibility: {
      modes: allModes,
      biomes: allBiomes,
      professions: [],
      weaponFamilies: [],
      minDay: 20,
      maxDay: null,
      prerequisites: [],
      prerequisiteStacks: [],
      excludes: [],
      rankedPolicy: "eligible",
      assignmentPolicy: "allowed",
    },
    draw: {
      dayWeights: [{ fromDay: 20, throughDay: null, weight: 3 }],
      duplicateWeightDecay: "none",
      fullStackBehavior: "exclude",
    },
    activationPolicies: [survivorActivation],
    acquisition: {
      kind: "mechanism",
      maxStacks: 1,
      conflictGroups: [],
      mechanismSlot: {
        scope: "personal",
        slots: 1,
        conflictGroups: [],
        replacement: "choose_replacement_before_question",
      },
    },
    runtime: {
      charges: { initial: 1, maximum: 1, reset: "never" },
      maxActiveInstances: 1,
      checkpointed: true,
    },
    effects: [
      {
        effectId: "rewrite_first_matching_event",
        trigger: {
          kind: "on_first_matching_event",
          events: ["answer_failed", "fatal_damage", "consumable_used"],
          reset: "run",
        },
        target: { kind: "self" },
        operation: {
          kind: "causal_rewrite",
          immutableOriginalAttempt: "append_causally_voided",
          aggregation: "exclude_original_from_rank_and_assignment",
          revealCorrectAnswer: true,
          replacementQuestion: "different_question",
          compensation: [
            "restore_trigger_event_pre_state",
            "refund_consumable_if_applicable",
          ],
          forbiddenRollback: [
            "positions",
            "other_players",
            "boss_state",
            "day_quota",
            "world_state",
            "database_history",
          ],
          selection: "first_matching_event_in_server_order",
        },
        cooldown: null,
        caps: [{ kind: "per_run", limit: 1 }],
      },
    ],
    antiAbusePolicy: null,
    bossBudgetPolicy: null,
    normalizedOverrides: [
      {
        code: "s159_audit_safe_compensation",
        reason: {
          zhCN: "保留不可修改的学习历史，并禁止世界状态回滚。",
          en: "Preserves immutable learning history and forbids world-state rollback.",
        },
        normalizedDescription: {
          zhCN:
            "补偿最先发生的匹配事件，原始答题保留为 causally_voided，且不回滚世界。",
          en: "Compensates the first matching event while retaining a causally-voided attempt and never rewinding the world.",
        },
      },
    ],
    rankedLearningPolicy: {
      kind: "s159_causal_void_exception",
      maxUsesPerRun: 1,
      originalAttempt: "immutable_causally_voided",
      aggregation: "excluded_from_rank_and_assignment",
    },
    checkpoint: {
      codecVersion: 1,
      stateKeys: ["charges"],
      restore: "exact_and_versioned",
    },
    visibility: {
      acquisition: "all_players",
      runtimeState: "server_only",
      opponentDetail: "icon_only",
    },
    presentation: {
      iconKey: "cards/s159-causal-rewrite",
      vfxFamily: "causal_rewrite",
      sfxCue: "cards/causal-rewrite",
      uiCue: "mechanism_triggered",
    },
    accessibility: {
      nonColorCue: "icon_and_caption",
      reducedMotionFallback: "opacity_only",
      flash: "localized_capped",
      shake: "none",
      audioCaptionKey: "card.causal_rewrite.triggered",
    },
  },
  {
    id: "Z001",
    faction: "zombie",
    contentVersion: "1.0.0",
    revision: 1,
    localization: {
      name: { zhCN: "晶壳增生", en: "Crystal Husk Proliferation" },
      description: {
        zhCN: "所有结晶体最大生命增加 8%。",
        en: "Increases maximum health of all Thralls by 8%.",
      },
      englishDescriptionStatus: "approved",
    },
    source: {
      catalogVersion: "card_catalog_v1_draft",
      originalNameZhCN: "腐肉增生",
      originalDescriptionZhCN: "所有僵尸最大生命增加 8%。",
      originalLimitZhCN: "5 层",
    },
    rarity: "white",
    tags: ["defense", "faction_shared", "pve_daily_eligible"],
    eligibility: {
      modes: allModes,
      biomes: allBiomes,
      professions: [],
      weaponFamilies: [],
      minDay: 1,
      maxDay: null,
      prerequisites: [],
      prerequisiteStacks: [],
      excludes: [],
      rankedPolicy: "eligible",
      assignmentPolicy: "allowed",
    },
    draw: {
      dayWeights: [{ fromDay: 1, throughDay: null, weight: 100 }],
      duplicateWeightDecay: "base_over_one_plus_stacks",
      fullStackBehavior: "exclude",
    },
    activationPolicies: zombieActivationPolicies,
    acquisition: {
      kind: "numeric",
      maxStacks: 5,
      conflictGroups: [],
      mechanismSlot: null,
    },
    runtime: { charges: null, maxActiveInstances: 1, checkpointed: true },
    effects: [
      {
        effectId: "increase_faction_max_health",
        trigger: { kind: "on_acquire" },
        target: { kind: "faction_all_entities" },
        operation: {
          kind: "modify_stat",
          stat: "max_health",
          mode: "add_percent",
          value: 8,
          unit: "percent",
        },
        cooldown: null,
        caps: [{ kind: "stat_total", limit: 40, unit: "percent" }],
      },
    ],
    antiAbusePolicy: null,
    bossBudgetPolicy: null,
    normalizedOverrides: [
      {
        code: "bloodless_crystal_presentation",
        reason: {
          zhCN: "敌人显示层统一为无血结晶体。",
          en: "Enemy presentation is normalized to bloodless crystalline Thralls.",
        },
        normalizedDescription: {
          zhCN: "所有结晶体最大生命增加 8%。",
          en: "Increases maximum health of all Thralls by 8%.",
        },
      },
    ],
    rankedLearningPolicy: { kind: "none" },
    checkpoint: {
      codecVersion: 1,
      stateKeys: ["stacks"],
      restore: "exact_and_versioned",
    },
    visibility: {
      acquisition: "all_players",
      runtimeState: "all_players",
      opponentDetail: "stacks",
    },
    presentation: {
      iconKey: "cards/z001-husk-proliferation",
      vfxFamily: "crystal_core",
      sfxCue: "cards/faction-health-up",
      uiCue: "faction_card_applied",
    },
    accessibility: {
      nonColorCue: "icon_and_caption",
      reducedMotionFallback: "static_icon",
      flash: "none",
      shake: "none",
      audioCaptionKey: "card.faction_health.applied",
    },
  },
  {
    id: "Z095",
    faction: "zombie",
    contentVersion: "1.0.0",
    revision: 1,
    localization: {
      name: { zhCN: "赤月终局", en: "Bloodless Red Moon" },
      description: {
        zhCN:
          "Boss 阶段每 20 秒生成一波价值为基础日预算 5% 的结晶体；每阶段累计上限 20%，Boss 死亡后停止生成。",
        en: "During the Boss phase, spawns a Thrall wave worth 5% of the base Day budget every 20 seconds, capped at 20% per phase and stopped on Boss death.",
      },
      englishDescriptionStatus: "approved",
    },
    source: {
      catalogVersion: "card_catalog_v1_draft",
      originalNameZhCN: "赤月终局",
      originalDescriptionZhCN:
        "Boss阶段天空进入赤月；每20秒生成一波价值为基础日预算5%的敌人，Boss死亡后立即停止。",
      originalLimitZhCN: "唯一；受实体上限",
    },
    rarity: "black_gold",
    tags: [
      "spawn",
      "boss",
      "mechanism",
      "faction_shared",
      "pve_daily_eligible",
    ],
    eligibility: {
      modes: allModes,
      biomes: allBiomes,
      professions: [],
      weaponFamilies: [],
      minDay: 20,
      maxDay: null,
      prerequisites: [],
      prerequisiteStacks: [],
      excludes: [],
      rankedPolicy: "eligible",
      assignmentPolicy: "allowed",
    },
    draw: {
      dayWeights: [{ fromDay: 20, throughDay: null, weight: 3 }],
      duplicateWeightDecay: "none",
      fullStackBehavior: "exclude",
    },
    activationPolicies: zombieActivationPolicies,
    acquisition: {
      kind: "mechanism",
      maxStacks: 1,
      conflictGroups: ["faction_spawn_mechanism"],
      mechanismSlot: {
        scope: "zombie_faction_shared",
        slots: 1,
        conflictGroups: ["faction_spawn_mechanism"],
        replacement: "choose_replacement_before_question",
      },
    },
    runtime: { charges: null, maxActiveInstances: 1, checkpointed: true },
    effects: [
      {
        effectId: "spawn_red_moon_wave",
        trigger: {
          kind: "on_interval",
          intervalMs: 20_000,
          phase: "boss_combat",
        },
        target: { kind: "legal_spawn_locations" },
        operation: {
          kind: "spawn_entity",
          archetype: "budget_wave",
          count: 1,
          spawnPolicy: {
            budgetSource: "base_day_budget",
            budgetCharge: {
              kind: "percentage",
              percentPerTrigger: 5,
              totalPercentCap: 20,
            },
            countsTowardDayQuota: false,
            blocksPhaseTransition: true,
            rewardPolicy: "none",
            infectionReward: "none",
            entityCapGroup: "map_hostile_cap",
            atEntityCap: "refuse_without_debt",
            stopSpawningWhen: "boss_death",
            existingEntitiesWhenStopped: "remain_and_require_cleanup",
          },
        },
        cooldown: {
          durationMs: 20_000,
          scope: "faction",
          reset: "boss_phase",
        },
        caps: [{ kind: "per_root_event", limit: 1 }],
      },
    ],
    antiAbusePolicy: null,
    bossBudgetPolicy: null,
    normalizedOverrides: [
      {
        code: "bloodless_crystal_presentation",
        reason: {
          zhCN: "敌人显示层统一为无血结晶体。",
          en: "Enemy presentation is normalized to bloodless crystalline Thralls.",
        },
        normalizedDescription: {
          zhCN:
            "Boss阶段天空进入赤月；每20秒生成一波结晶体，Boss死亡后立即停止。",
          en: "During the Boss phase, the red moon spawns Thrall waves until the Boss dies.",
        },
      },
    ],
    rankedLearningPolicy: { kind: "none" },
    checkpoint: {
      codecVersion: 1,
      stateKeys: ["nextWaveAt", "spentBudgetPercent"],
      restore: "exact_and_versioned",
    },
    visibility: {
      acquisition: "all_players",
      runtimeState: "all_players",
      opponentDetail: "full",
    },
    presentation: {
      iconKey: "cards/z095-red-moon",
      vfxFamily: "spawn_portal",
      sfxCue: "cards/red-moon-wave",
      uiCue: "boss_warning",
    },
    accessibility: {
      nonColorCue: "icon_and_caption",
      reducedMotionFallback: "single_particle_burst",
      flash: "localized_capped",
      shake: "optional_low",
      audioCaptionKey: "card.red_moon.wave_incoming",
    },
  },
];

export const REPRESENTATIVE_CARD_CATALOG = assertValidCatalog(
  rawRepresentativeCatalog,
);
