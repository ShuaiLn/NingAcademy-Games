export type SurvivorRoleId =
  | "warrior"
  | "medic"
  | "mage"
  | "assassin"
  | "guardian";

export interface SurvivorRoleDefinition {
  readonly id: SurvivorRoleId;
  readonly nameEn: string;
  readonly nameZh: string;
  /** New-role unlock questions. These pre-game questions never have a timer. */
  readonly unlockQuestionCount: number;
  readonly summaryEn: string;
  readonly summaryZh: string;
}

export const survivorRoles = [
  {
    id: "warrior",
    nameEn: "Warrior",
    nameZh: "战士",
    unlockQuestionCount: 0,
    summaryEn: "Balanced frontline damage and durability",
    summaryZh: "均衡的前线输出与生存能力",
  },
  {
    id: "medic",
    nameEn: "Medic",
    nameZh: "医疗兵",
    unlockQuestionCount: 10,
    summaryEn: "Healing and team recovery",
    summaryZh: "治疗与团队恢复",
  },
  {
    id: "mage",
    nameEn: "Mage",
    nameZh: "法师",
    unlockQuestionCount: 10,
    summaryEn: "Elemental control and area damage",
    summaryZh: "元素控制与范围伤害",
  },
  {
    id: "assassin",
    nameEn: "Assassin",
    nameZh: "刺客",
    unlockQuestionCount: 10,
    summaryEn: "Precision damage and high mobility",
    summaryZh: "精准伤害与高机动性",
  },
  {
    id: "guardian",
    nameEn: "Guardian",
    nameZh: "守卫",
    unlockQuestionCount: 10,
    summaryEn: "Protection and threat control",
    summaryZh: "保护与威胁控制",
  },
] as const satisfies readonly SurvivorRoleDefinition[];

export interface RoleGateRequirement {
  readonly minimumFirstAttemptAccuracy: number;
  readonly questionCount: number;
  readonly timed: false;
}

/**
 * The first role is permanently free. Every other role uses an untimed
 * pre-game gate; in-game card and rescue questions use separate timed rules.
 */
export function getRoleGateRequirement(
  roleId: SurvivorRoleId,
  unlockedRoleIds: ReadonlySet<SurvivorRoleId>,
): RoleGateRequirement {
  const role = survivorRoles.find((candidate) => candidate.id === roleId);
  if (role === undefined) {
    throw new RangeError(`Unknown survivor role: ${roleId}`);
  }

  if (role.id === "warrior") {
    return { minimumFirstAttemptAccuracy: 0, questionCount: 0, timed: false };
  }

  // An already unlocked non-default profession requires one correct warm-up
  // answer. A first unlock is a 10-question batch with >=60% first-answer
  // accuracy, matching rev2.1 section 4.3.
  return unlockedRoleIds.has(role.id)
    ? { minimumFirstAttemptAccuracy: 1, questionCount: 1, timed: false }
    : { minimumFirstAttemptAccuracy: 0.6, questionCount: role.unlockQuestionCount, timed: false };
}
