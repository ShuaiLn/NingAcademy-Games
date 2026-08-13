"use client";

import { getRoleGateRequirement, survivorRoles, type SurvivorRoleId } from "@/lib/role-gate";

export interface RoleSelectionProps {
  readonly onSelect: (roleId: SurvivorRoleId) => void;
}

export function RoleSelection({ onSelect }: RoleSelectionProps): React.JSX.Element {
  return (
    <section className="role-select" aria-labelledby="role-select-title">
      <div className="section-heading">
        <p className="eyebrow">STEP 1 // LOCAL ROLE GATE</p>
        <h2 id="role-select-title">选择幸存者职业</h2>
        <p>先锋首次免费；其他职业需完成无时限本地模拟题。答案保存在浏览器内，不代表生产判题安全。</p>
      </div>
      <div className="role-grid">
        {survivorRoles.map((role) => {
          const requirement = getRoleGateRequirement(role.id, new Set());
          return (
            <button
              className={`role-card role-${role.id}`}
              key={role.id}
              onClick={() => onSelect(role.id)}
              type="button"
            >
              <span className="role-index">{String(survivorRoles.indexOf(role) + 1).padStart(2, "0")}</span>
              <strong>{role.nameZh}</strong>
              <span lang="en">{role.nameEn}</span>
              <small>{role.summaryZh} / {role.summaryEn}</small>
              <b>
                {requirement.questionCount === 0
                  ? "首次免费 / Free first role"
                  : `${requirement.questionCount} 道无时限题 / ${requirement.questionCount} untimed`}
              </b>
            </button>
          );
        })}
      </div>
    </section>
  );
}
