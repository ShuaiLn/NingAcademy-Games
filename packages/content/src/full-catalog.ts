import { CARD_ENGLISH_NAMES } from "./catalog-english-names.js";
import { RAW_CARD_CATALOG, type RawCatalogCard } from "./catalog-source.js";
import {
  AuthoredCardRecordSchema,
  CardDefinitionSchema,
  type AuthoredCardRecord,
  type CardDefinition,
  type CardId,
  type SpawnPolicy,
} from "./schema.js";
import { assertValidCatalog } from "./validation.js";

const allBiomes = ["house", "grass", "desert", "hell"] as const;
const allModes = ["solo_pve", "coop_pve", "asymmetric"] as const;

const rarityMap = {
  白卡: "white",
  银卡: "silver",
  金卡: "gold",
  钻石卡: "diamond",
  黑金卡: "black_gold",
} as const;

const minDayByRarity = {
  white: 1,
  silver: 3,
  gold: 6,
  diamond: 12,
  black_gold: 20,
} as const;

const weightByRarity = {
  white: 100,
  silver: 30,
  gold: 20,
  diamond: 15,
  black_gold: 3,
} as const;

const survivorActivation = {
  kind: "survivor_card_opportunity",
  modes: [...allModes],
  selection: "owner_three_choose_one",
  resolution: "timed_personal_question",
  onSuccess: "apply_atomically",
  onFailure: "lose_card_and_take_10_nonlethal_true_damage",
  scope: "owner",
} as const;

const zombieActivations = [
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

const spawnIds = new Set([
  "S031",
  "S050",
  "S051",
  "S056",
  "S064",
  "S065",
  "S066",
  "S067",
  "S115",
  "S116",
  "S117",
  "S131",
  "S146",
  "S147",
  "Z015",
  "Z019",
  "Z023",
  "Z028",
  "Z031",
  "Z040",
  "Z043",
  "Z068",
  "Z073",
  "Z075",
  "Z076",
  "Z078",
  "Z079",
  "Z084",
  "Z087",
  "Z089",
  "Z090",
  "Z093",
  "Z095",
  "Z096",
  "Z097",
]);

const bossBudgetIds = new Set(["Z084", "Z093"]);
const antiAbuseIds = new Set(["S121", "Z082"]);
const learningIds = new Set([
  "S021",
  "S022",
  "S023",
  "S043",
  "S052",
  "S123",
  "S159",
]);
const rescueIds = new Set([
  "S023",
  "S042",
  "S052",
  "S070",
  "S078",
  "S099",
  "S113",
  "S139",
  "S148",
  "S151",
  "S158",
  "S159",
  "S160",
  "Z094",
]);

const weaponIds = new Set([
  "S045",
  "S046",
  "S047",
  "S048",
  "S061",
  "S062",
  "S063",
  "S073",
  "S074",
  "S075",
  "S125",
  "S126",
  "S127",
  "S128",
  "S129",
  "S141",
  "S142",
  "S143",
  "S144",
  "S145",
  "S153",
  "S154",
  "S155",
  "S156",
  "S157",
]);

const mechanismIds = new Set([
  "S012",
  "S016",
  "S031",
  "S033",
  "S036",
  "S037",
  "S038",
  "S039",
  "S043",
  "S053",
  "S057",
  "S058",
  "S060",
  "S066",
  "S067",
  "S068",
  "S069",
  "S070",
  "S071",
  "S072",
  "S076",
  "S077",
  "S078",
  "S093",
  "S097",
  "S104",
  "S105",
  "S107",
  "S118",
  "S123",
  "S132",
  "S133",
  "S134",
  "S135",
  "S139",
  "S140",
  "S146",
  "S147",
  "S148",
  "S149",
  "S150",
  "S151",
  "S152",
  "S158",
  "S159",
  "S160",
  "Z037",
  "Z038",
  "Z039",
  "Z040",
  "Z074",
  "Z076",
  "Z079",
  "Z084",
  "Z086",
  "Z087",
  "Z092",
  "Z093",
  "Z095",
  "Z096",
  "Z097",
  "Z098",
  "Z099",
  "Z100",
]);

const explicitPrerequisites: Readonly<
  Record<string, readonly { readonly cardId: CardId; readonly minimumStacks: number }[]>
> = {
  S044: [{ cardId: "S024", minimumStacks: 2 }],
  S059: [{ cardId: "S007", minimumStacks: 1 }],
  S061: [{ cardId: "S047", minimumStacks: 1 }],
  S062: [{ cardId: "S046", minimumStacks: 1 }],
  S063: [{ cardId: "S048", minimumStacks: 1 }],
  S067: [{ cardId: "S050", minimumStacks: 1 }],
  S073: [{ cardId: "S062", minimumStacks: 1 }],
  S074: [{ cardId: "S061", minimumStacks: 1 }],
  S075: [{ cardId: "S045", minimumStacks: 1 }],
  S100: [{ cardId: "S050", minimumStacks: 1 }],
  S101: [{ cardId: "S056", minimumStacks: 1 }],
  S130: [{ cardId: "S032", minimumStacks: 1 }],
  S148: [{ cardId: "S056", minimumStacks: 1 }],
  S150: [{ cardId: "S053", minimumStacks: 1 }],
  S141: [{ cardId: "S125", minimumStacks: 1 }],
  S142: [{ cardId: "S126", minimumStacks: 1 }],
  S143: [{ cardId: "S127", minimumStacks: 1 }],
  S144: [{ cardId: "S128", minimumStacks: 1 }],
  S145: [{ cardId: "S129", minimumStacks: 1 }],
  S153: [{ cardId: "S141", minimumStacks: 1 }],
  S154: [{ cardId: "S142", minimumStacks: 1 }],
  S155: [{ cardId: "S143", minimumStacks: 1 }],
  S156: [{ cardId: "S144", minimumStacks: 1 }],
  S157: [{ cardId: "S145", minimumStacks: 1 }],
};

const implementedIds = new Set(["S001", "S159", "Z001", "Z095"]);

const parseMaxStacks = (limit: string): number => {
  const layer = /(?:最多)?\s*(\d+)\s*层/u.exec(limit);
  if (layer !== null) {
    return Number(layer[1]);
  }
  return 1;
};

const classifyCapabilities = (
  raw: RawCatalogCard,
): AuthoredCardRecord["requiredCapabilities"] => {
  const capabilities = new Set<AuthoredCardRecord["requiredCapabilities"][number]>([
    "combat",
  ]);
  if (weaponIds.has(raw.id) || /武器|枪|剑|矛|弹匣|射击|子弹|ADS/u.test(raw.description)) {
    capabilities.add("weapon");
  }
  if (/道具|弹药|手雷|治疗品|绷带|急救包|携带|补给/u.test(raw.description)) {
    capabilities.add("inventory");
  }
  if (/炮塔|无人机|护盾发生器|地雷|陷阱|部署/u.test(raw.description)) {
    capabilities.add("deployable");
  }
  if (raw.id.startsWith("Z") || /AI|感知|威胁|目标|包抄/u.test(raw.description)) {
    capabilities.add("ai");
  }
  if (/导航|跃|冲刺|传送|裂口|房间|地形/u.test(raw.description)) {
    capabilities.add("navigation");
  }
  if (/夜晚|天空|沙暴|火雨|酸雨|区域|照明|视距/u.test(raw.description)) {
    capabilities.add("environment");
  }
  if (/Day|配额|生成预算/u.test(raw.description)) {
    capabilities.add("day_flow");
  }
  if (/Boss/u.test(raw.description)) {
    capabilities.add("boss");
  }
  if (bossBudgetIds.has(raw.id)) {
    capabilities.add("boss_budget");
  }
  if (rescueIds.has(raw.id) || /救援|复活|倒地|致命/u.test(raw.description)) {
    capabilities.add("rescue");
  }
  if (learningIds.has(raw.id) || /答题|听力题|三选一/u.test(raw.description)) {
    capabilities.add("learning");
  }
  if (antiAbuseIds.has(raw.id)) {
    capabilities.add("anti_abuse");
  }
  if (spawnIds.has(raw.id)) {
    capabilities.add("spawn");
  }
  if (raw.id.startsWith("Z")) {
    capabilities.add("presentation");
  }
  if (["S021", "S022", "S123", "S159"].includes(raw.id)) {
    capabilities.add("ranked");
  }
  return [...capabilities];
};

const createSpawnPolicy = (raw: RawCatalogCard): SpawnPolicy => {
  const isBudgetPercent = /预算\s*(\d+)%|预算(\d+)%/u.exec(raw.description);
  const isBossSummon = ["Z040", "Z084", "Z093", "Z095"].includes(raw.id);
  const freeSpawn = /免费|复生|复制|生成/u.test(raw.description);
  return {
    budgetSource:
      isBossSummon ? "shared_boss_budget" : freeSpawn ? "card_budget" : "day_quota",
    budgetCharge:
      isBudgetPercent !== null
        ? {
            kind: "percentage",
            percentPerTrigger: Number(isBudgetPercent[1] ?? isBudgetPercent[2]),
            totalPercentCap: raw.id === "Z095" ? 20 : Number(isBudgetPercent[1] ?? isBudgetPercent[2]),
          }
        : freeSpawn
          ? { kind: "free", maximumFreeEntitiesPerTrigger: 100 }
          : { kind: "entity_archetype_cost" },
    countsTowardDayQuota: !/不计配额/u.test(raw.description) && !isBossSummon,
    blocksPhaseTransition: ["Z084", "Z093", "Z095"].includes(raw.id),
    rewardPolicy: /奖励3倍/u.test(raw.description)
      ? "standard"
      : raw.id.startsWith("Z")
        ? "none"
        : "standard",
    infectionReward: "none",
    entityCapGroup: "map_hostile_cap",
    atEntityCap: "refuse_without_debt",
    stopSpawningWhen: isBossSummon ? "boss_death" : "day_end",
    existingEntitiesWhenStopped: ["Z084", "Z093", "Z095"].includes(raw.id)
      ? "remain_and_require_cleanup"
      : "despawn_no_reward",
  };
};

const bloodlessText = (text: string): string =>
  text
    .replaceAll("腐肉", "晶壳")
    .replaceAll("尸液", "晶质余烬")
    .replaceAll("酸性血液", "酸性晶液")
    .replaceAll("血雾", "赤晶雾")
    .replaceAll("血月剑", "赤月剑")
    .replaceAll("僵尸", "结晶体")
    .replaceAll("尸壳", "晶壳")
    .replaceAll("腐躯", "裂晶躯壳")
    .replaceAll("尸体", "破碎晶壳")
    .replaceAll("尸骨", "晶甲")
    .replaceAll("骨刺", "晶刺")
    .replaceAll("白骨", "白晶")
    .replaceAll("颅骨", "晶冠")
    .replaceAll("骨质", "晶质")
    .replaceAll("尸潮", "晶潮")
    .replaceAll("骨墙", "晶墙")
    .replaceAll("吸血", "能量汲取");

const normalizedOverride = (
  code: AuthoredCardRecord["normalizedOverrides"][number]["code"],
  raw: RawCatalogCard,
  normalizedDescription: string,
): AuthoredCardRecord["normalizedOverrides"][number] => ({
  code,
  reason: {
    zhCN: "依据已锁定的安全、公平性和权威服务器规则规范原始草案。",
    en: "Normalizes the draft under locked safety, fairness, and authoritative-server rules.",
  },
  normalizedDescription: {
    zhCN: normalizedDescription,
    en: `Normalized policy for ${CARD_ENGLISH_NAMES[raw.id] ?? raw.id}.`,
  },
});

const buildAuthoredRecord = (raw: RawCatalogCard): AuthoredCardRecord => {
  const rarity = rarityMap[raw.rarity as keyof typeof rarityMap];
  if (rarity === undefined) {
    throw new Error(`Unknown rarity ${raw.rarity} on ${raw.id}`);
  }
  const faction = raw.id.startsWith("S") ? "survivor" : "zombie";
  const tags: AuthoredCardRecord["tags"] = faction === "zombie"
    ? ["faction_shared", "pve_daily_eligible"]
    : ["utility"];
  if (weaponIds.has(raw.id)) tags.push("weapon");
  if (spawnIds.has(raw.id)) tags.push("spawn");
  if (mechanismIds.has(raw.id)) tags.push("mechanism");
  if (/Boss/u.test(raw.description)) tags.push("boss");
  if (learningIds.has(raw.id)) tags.push("learning_modifier");
  if (["S070", "S078", "S139", "S148", "S160"].includes(raw.id)) {
    tags.push("death_protection");
  }

  const overrides: AuthoredCardRecord["normalizedOverrides"] = [];
  const normalizedDescription = faction === "zombie" ? bloodlessText(raw.description) : raw.description;
  if (faction === "zombie") {
    overrides.push(
      normalizedOverride("bloodless_crystal_presentation", raw, normalizedDescription),
    );
  }
  if (raw.id === "S121") {
    overrides.push(
      normalizedOverride(
        "s121_anti_farm",
        raw,
        "对玩家操控结晶体伤害增加12%；同一对手首具操控体完整奖励，后续仅25%，每名对手每Day额外升级进度最多1点。",
      ),
    );
  }
  if (raw.id === "S159") {
    overrides.push(
      normalizedOverride(
        "s159_audit_safe_compensation",
        raw,
        "每局一次补偿服务器顺序中最先发生的答错、致命伤害或消耗品使用；原始学习记录永久保留为causally_voided，绝不回滚位置、其他玩家、Boss、配额、世界或数据库历史。",
      ),
    );
  }
  if (raw.id === "Z082") {
    overrides.push(
      normalizedOverride(
        "z082_effective_heal_tax",
        raw,
        "仅在真实敌对伤害后的有效消耗品治疗产生收益；同一幸存者60秒一次、每Day最多3次，且受感染经济总上限约束。",
      ),
    );
  }
  if (raw.id === "Z084") {
    overrides.push(
      normalizedOverride(
        "z084_summon_cleanup",
        raw,
        "Boss 35%生命时生成两个分魂；Boss死亡后停止新召唤，但现有分魂必须清除后才能进入救援结算和下一Day。",
      ),
    );
  }
  if (raw.id === "Z093") {
    overrides.push(
      normalizedOverride(
        "z093_shared_boss_budget",
        raw,
        "副Boss不增加总Boss预算；所有Boss拆分固定团队HP和普通DPS预算，共享召唤预算与一个大招令牌。",
      ),
    );
  }

  return AuthoredCardRecordSchema.parse({
    id: raw.id,
    faction,
    rarity,
    nameZhCN: faction === "zombie" ? bloodlessText(raw.name) : raw.name,
    nameEn: CARD_ENGLISH_NAMES[raw.id] ?? raw.id,
    descriptionZhCN:
      overrides.find((override) => override.code !== "bloodless_crystal_presentation")
        ?.normalizedDescription.zhCN ?? normalizedDescription,
    descriptionEn: `Pending human translation: ${CARD_ENGLISH_NAMES[raw.id] ?? raw.id}.`,
    limitZhCN: raw.limit,
    minDay: minDayByRarity[rarity],
    prerequisites: (explicitPrerequisites[raw.id] ?? []).map((entry) => entry.cardId),
    maxStacks: parseMaxStacks(raw.limit),
    tags: [...new Set(tags)],
    requiredCapabilities: classifyCapabilities(raw),
    implementation: implementedIds.has(raw.id)
      ? { status: "implemented", implementationRef: `engine://${raw.id}` }
      : {
          status: "blocked",
          blockedReason: `Awaiting the ${classifyCapabilities(raw).join(", ")} engine capabilities required by ${raw.id}.`,
        },
    safetyDomains: [
      ...(learningIds.has(raw.id) ? (["learning"] as const) : []),
      ...(["S021", "S022", "S123", "S159"].includes(raw.id)
        ? (["ranked"] as const)
        : []),
      ...(spawnIds.has(raw.id) ? (["spawn"] as const) : []),
      ...(bossBudgetIds.has(raw.id) ? (["boss_budget"] as const) : []),
      ...(antiAbuseIds.has(raw.id) ? (["anti_abuse"] as const) : []),
    ],
    spawnPolicies: spawnIds.has(raw.id) ? [createSpawnPolicy(raw)] : [],
    antiAbusePolicy:
      raw.id === "S121"
        ? {
            kind: "s121_player_body_progress",
            effectiveEventOnly: true,
            repeatedTargetDecayPercent: [100, 50, 25],
            repeatedTargetResetSeconds: 30,
            perTargetCooldownSeconds: 0,
            perTargetPerDayCap: 1,
            globalPerDayCap: 4,
            rejectedSources: ["shield", "armor", "overkill", "friendly", "replayed"],
          }
        : raw.id === "Z082"
          ? {
              kind: "z082_effective_heal_tax",
              effectiveEventOnly: true,
              repeatedTargetDecayPercent: [100, 50, 25],
              repeatedTargetResetSeconds: 30,
              perTargetCooldownSeconds: 60,
              perTargetPerDayCap: 3,
              globalPerDayCap: 12,
              rejectedSources: ["shield", "armor", "overheal", "friendly", "replayed"],
            }
          : null,
    bossBudgetPolicy:
      raw.id === "Z084"
        ? {
            kind: "z084_soul_cleanup",
            totalHpBudgetMultiplier: 1,
            totalDamageBudgetMultiplier: 1,
            sharesMajorSkillToken: true,
            blocksPhaseTransitionUntilCleanup: true,
            countsTowardDayQuota: false,
          }
        : raw.id === "Z093"
          ? {
              kind: "z093_shared_boss_budget",
              totalHpBudgetMultiplier: 1,
              totalDamageBudgetMultiplier: 1,
              sharesMajorSkillToken: true,
              blocksPhaseTransitionUntilCleanup: true,
              countsTowardDayQuota: false,
            }
          : null,
    normalizedOverrides: overrides,
  });
};

const conflictGroupsFor = (
  record: AuthoredCardRecord,
): CardDefinition["acquisition"]["conflictGroups"] => {
  if (["S070", "S078", "S139", "S148"].includes(record.id)) {
    return ["personal_death_protection"];
  }
  if (record.id === "S160") return ["team_wipe_protection"];
  if (record.tags.includes("weapon")) return ["primary_weapon_replacement"];
  if (record.faction === "zombie" && record.tags.includes("spawn")) {
    return ["faction_spawn_mechanism"];
  }
  return [];
};

const spawnArchetypeFor = (id: string): "budget_wave" | "boss_soul" | "secondary_boss" | "base_thrall" => {
  if (id === "Z084") return "boss_soul";
  if (id === "Z093") return "secondary_boss";
  return id.startsWith("Z") ? "base_thrall" : "budget_wave";
};

const compileRecord = (record: AuthoredCardRecord, raw: RawCatalogCard): CardDefinition => {
  const prerequisiteStacks = explicitPrerequisites[record.id] ?? [];
  const mechanism = record.tags.includes("mechanism");
  const acquisitionKind = record.tags.includes("weapon")
    ? "weapon"
    : mechanism
      ? "mechanism"
      : "numeric";
  const engineEffect: CardDefinition["effects"][number] = {
    effectId: `rule_${record.id.toLowerCase()}`,
    trigger: { kind: "on_engine_rule_event", handlerKey: record.id },
    target: {
      kind: record.faction === "survivor" ? "self" : "faction_all_entities",
    },
    operation: {
      kind: "engine_rule",
      handlerKey: record.id,
      implementation: record.implementation,
      requiredCapabilities: record.requiredCapabilities,
      safetyDomains: record.safetyDomains,
      parameters: {
        sourceEffectZhCN: raw.description,
        sourceLimitZhCN: raw.limit,
      },
    },
    cooldown: null,
    caps: [{ kind: "per_root_event", limit: 32 }],
  };

  const effects: CardDefinition["effects"] =
    record.id === "S159"
      ? [
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
        ]
      : [
          engineEffect,
          ...record.spawnPolicies.map((policy, index) => ({
            effectId: `spawn_${record.id.toLowerCase()}_${index + 1}`,
            trigger: { kind: "on_engine_rule_event" as const, handlerKey: record.id },
            target: { kind: "legal_spawn_locations" as const },
            operation: {
              kind: "spawn_entity" as const,
              archetype: spawnArchetypeFor(record.id),
              count: 1,
              spawnPolicy: policy,
            },
            cooldown: null,
            caps: [{ kind: "per_root_event" as const, limit: 32 }],
          })),
        ];

  return CardDefinitionSchema.parse({
    id: record.id,
    faction: record.faction,
    contentVersion: "1.0.0",
    revision: 1,
    localization: {
      name: { zhCN: record.nameZhCN, en: record.nameEn },
      description: { zhCN: record.descriptionZhCN, en: record.descriptionEn },
      englishDescriptionStatus: "blocked_review",
    },
    source: {
      catalogVersion: "card_catalog_v1_draft",
      originalNameZhCN: raw.name,
      originalDescriptionZhCN: raw.description,
      originalLimitZhCN: raw.limit,
    },
    rarity: record.rarity,
    tags: record.tags,
    eligibility: {
      modes: record.id === "S121" || record.id.startsWith("Z")
        ? [...allModes]
        : [...allModes],
      biomes: [...allBiomes],
      professions: [],
      weaponFamilies: [],
      minDay: record.minDay,
      maxDay: null,
      prerequisites: record.prerequisites,
      prerequisiteStacks,
      excludes: [],
      rankedPolicy: ["S021", "S022", "S123"].includes(record.id)
        ? "excluded"
        : "eligible",
      assignmentPolicy: ["S021", "S022", "S123"].includes(record.id)
        ? "teacher_opt_in"
        : "allowed",
    },
    draw: {
      dayWeights: [
        {
          fromDay: record.minDay,
          throughDay: null,
          weight: weightByRarity[record.rarity],
        },
      ],
      duplicateWeightDecay:
        record.maxStacks > 1 ? "base_over_one_plus_stacks" : "none",
      fullStackBehavior: "exclude",
    },
    activationPolicies:
      record.faction === "survivor" ? [survivorActivation] : zombieActivations,
    acquisition: {
      kind: acquisitionKind,
      maxStacks: record.maxStacks,
      conflictGroups: conflictGroupsFor(record),
      mechanismSlot: mechanism
        ? {
            scope:
              record.faction === "zombie"
                ? "zombie_faction_shared"
                : record.id === "S160"
                  ? "team_shared"
                  : "personal",
            slots: 1,
            conflictGroups: conflictGroupsFor(record),
            replacement: "choose_replacement_before_question",
          }
        : null,
    },
    runtime: {
      charges:
        /每局一次/u.test(record.limitZhCN) || record.id === "S159"
          ? { initial: 1, maximum: 1, reset: "never" }
          : /每个?Day一次|每Day一次/u.test(record.limitZhCN)
            ? { initial: 1, maximum: 1, reset: "day" }
            : null,
      maxActiveInstances: 100,
      checkpointed: true,
    },
    effects,
    antiAbusePolicy: record.antiAbusePolicy,
    bossBudgetPolicy: record.bossBudgetPolicy,
    normalizedOverrides: record.normalizedOverrides,
    rankedLearningPolicy:
      record.id === "S159"
        ? {
            kind: "s159_causal_void_exception",
            maxUsesPerRun: 1,
            originalAttempt: "immutable_causally_voided",
            aggregation: "excluded_from_rank_and_assignment",
          }
        : learningIds.has(record.id)
          ? { kind: "practice_only_modifier" }
          : { kind: "none" },
    checkpoint: {
      codecVersion: 1,
      stateKeys: ["stacks", "runtimeState"],
      restore: "exact_and_versioned",
    },
    visibility: {
      acquisition: record.faction === "zombie" ? "all_players" : "owner",
      runtimeState: record.faction === "zombie" ? "all_players" : "owner",
      opponentDetail: record.faction === "zombie" ? "stacks" : "none",
    },
    presentation: {
      iconKey: `cards/${record.id.toLowerCase()}`,
      vfxFamily: record.faction === "zombie" ? "crystal_core" : "stat_pulse",
      sfxCue: `cards/${record.id.toLowerCase()}`,
      uiCue:
        record.faction === "zombie"
          ? "faction_card_applied"
          : mechanism
            ? "mechanism_armed"
            : "stack_added",
    },
    accessibility: {
      nonColorCue: "icon_and_caption",
      reducedMotionFallback: "static_icon",
      flash: "none",
      shake: "none",
      audioCaptionKey: `card.${record.id.toLowerCase()}.applied`,
    },
  });
};

export const AUTHORED_CARD_RECORDS: readonly AuthoredCardRecord[] = Object.freeze(
  RAW_CARD_CATALOG.map(buildAuthoredRecord),
);

export const FULL_CARD_CATALOG = assertValidCatalog(
  AUTHORED_CARD_RECORDS.map((record, index) => {
    const raw = RAW_CARD_CATALOG[index];
    if (raw === undefined || raw.id !== record.id) {
      throw new Error(`Raw/normalized catalog order mismatch at ${record.id}`);
    }
    return compileRecord(record, raw);
  }),
);

export const SURVIVOR_CARD_CATALOG = Object.freeze(
  FULL_CARD_CATALOG.filter((card) => card.faction === "survivor"),
);

export const ZOMBIE_CARD_CATALOG = Object.freeze(
  FULL_CARD_CATALOG.filter((card) => card.faction === "zombie"),
);
