export type SurvivorRoleId =
  | "vanguard"
  | "medic"
  | "guardian"
  | "engineer"
  | "psion";

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
    id: "vanguard",
    nameEn: "Vanguard",
    nameZh: "先锋",
    unlockQuestionCount: 0,
    summaryEn: "Balanced damage and mobility",
    summaryZh: "均衡输出与机动",
  },
  {
    id: "medic",
    nameEn: "Medic",
    nameZh: "医疗兵",
    unlockQuestionCount: 2,
    summaryEn: "Healing and team recovery",
    summaryZh: "治疗与团队恢复",
  },
  {
    id: "guardian",
    nameEn: "Guardian",
    nameZh: "守卫",
    unlockQuestionCount: 3,
    summaryEn: "Protection and threat control",
    summaryZh: "保护与威胁控制",
  },
  {
    id: "engineer",
    nameEn: "Engineer",
    nameZh: "工程师",
    unlockQuestionCount: 4,
    summaryEn: "Deployables and supplies",
    summaryZh: "部署物与补给",
  },
  {
    id: "psion",
    nameEn: "Psion",
    nameZh: "灵能师",
    unlockQuestionCount: 5,
    summaryEn: "Control and elemental effects",
    summaryZh: "控制与元素效果",
  },
] as const satisfies readonly SurvivorRoleDefinition[];

export interface RoleGateRequirement {
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

  if (role.id === "vanguard") {
    return { questionCount: 0, timed: false };
  }

  return {
    // An already unlocked non-default profession still requires one warm-up
    // question each match. First-time unlocks use the profession's larger gate.
    questionCount: unlockedRoleIds.has(role.id) ? 1 : role.unlockQuestionCount,
    timed: false,
  };
}
