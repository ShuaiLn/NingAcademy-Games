# NingAcademy Game V1 完整待办清单（rev2.1 执行版）

> 生成时间：2026-08-16。基于 `NingAcademy-3DFPS-V1-实施计划-rev2.1-BossIndependent.md`（下称"计划书"）逐条拆解，并对照 `NingAcademy-Games` 仓库当前代码、`docs/project-status-rev2.1.md`、`docs/locked-product-rules.md`、`docs/main-site-integration.md` 与主站 `NingAcademy` 仓库的 `docs/p1/`、`supabase/migrations/`、`AGENTS.md` 核对了实际完成度。
>
> **这不是一份新计划，是把计划书 §2–§6 转成可以逐条打勾执行的任务清单。** 规则本身以计划书为准；本文档若与计划书冲突，以计划书为准并回来改本文档。
>
> ## 状态图例
>
> | 标记 | 含义 |
> |---|---|
> | ✅ | 已完成（代码/文档/审计已存在并可验证） |
> | 🔄 | AI 当前可继续执行 —— 没有外部阻塞，可以直接动手（写代码、跑 CLI、调用已授权的 Supabase/Vercel/Cloudflare API、跑测试） |
> | ⬜ | AI 后续可执行 —— 属于 AI 的工作范围，但排在某个前置步骤（可能含 🚫 项）之后，前置项一清就能接着做 |
> | 🚫 | **仅限以下 4 类事项**：①创建 Vercel Production 项目 ②正式域名/DNS 配置 ③创建及授权 Production 受限数据库 LOGIN ④Production migration 的最终人工审批。**除这 4 类外**，任何能通过代码、CLI、GitHub、Supabase MCP、Vercel CLI/API、Cloudflare API、自动化脚本、测试工具或现有授权完成的工作，一律标 🔄/⬜，不因"涉及部署/配置/验证/Production"而默认阻塞 |
> | ⚠️ | 需要人工设计/美术/产品决策才能继续（问题是内容未定案，不是操作权限），不能因为"有风险"就自动归类为 🚫 |
>
> ## 如何使用本文档
>
> 1. 按 §0 总览表确认当前所处阶段（当前重心：**P0 生产部署收尾 + P1 收尾验证 + P4/P5/P6/P7 引擎开发**）。
> 2. 每个阶段内部条目**大致**按依赖顺序排列，但同一层级标"可并行"的条目之间没有先后要求。
> 3. 阶段之间的强依赖见每节开头的"前置依赖"。**不要**在前置未完成时开始下一阶段的引擎开发（计划书 §2 明确写死 P-1 未过禁止设计任何游戏表；rev2 同理要求 P4 卡牌先于 P5 引擎接线，P6 地图 hash 先于 P9 联机验证）。
> 4. 每次完成一批任务后，回来把对应 `- [ ]` 改成 `- [x]`，并更新 §0 总览表与 `docs/project-status-rev2.1.md`。
> 5. **🚫 只保留 4 类事项**（见状态图例）。R2 bucket 创建、Cloudflare Worker 部署、Vercel/主站环境变量配置、Production migration 的**实际执行**（区别于"批准"）等，全部通过对应平台的 CLI/API/Supabase MCP 工具由 AI 完成，标 🔄/⬜。真正写入任何 Production DDL/DML 前，仍需确认对应的 🚫 审批/授权步骤已经完成——这是执行前提，不是把整个任务标成 🚫 的理由。

---

## 0. 全局状态总览（速览表）

| 阶段 | 内容 | 状态 | 主要缺口 |
|---|---|---|---|
| P-1 | 数据库审计（主站仓库） | ✅ 完成 | 未来任何新 Production 发布前需要**重新**跑只读 preflight（不是一次性的） |
| P0 | 独立仓库、身份链、P2P 信令基础设施 | 🔄 数据库层 9/10 migration 已部署，其余卡在 4 项 🚫 用户操作 | **需要你本人操作的 4 件事**（见 §2.2.0）：①批准 `rls_auto_enable()` 收权 migration 上线（已起草+CI 通过，只差批准）②创建受限数据库 LOGIN ③创建 Games Vercel Production 项目 ④配置 DNS。这 4 项就位后，§2.2.1–2.2.5（配置/部署/验证/parity audit）全部由 AI 接续，不需要你再手动操作 |
| P1 | 单人垂直切片（一图一枪一怪） | 🔄 基本完成，缺对抗性测试 | 缺显式的"拒绝伪造权威状态"测试用例 |
| P2 | Babylon 场景/预测/可访问性/R2 资产管线 | 🔄 可访问性工具链完成，资产管线未接入 | R2 四 bucket、`assets.ningacademy.org`、client 预测/reconciliation 未确认 |
| P3 | 题目系统与听力防泄漏 | 🔄 协议层完成，判题/音频管线未做 | 听力 HMAC key 轮换、Cloudflare Worker、答题保护、听力静音总线均未实现 |
| P4 | 卡牌 DSL 与内容 | 🔄 DSL + 260/262 张卡数据完成，运行时引擎未接线 | S161/S162 缺失；机制槽/堆叠/proc 预算完全未进入 game-core |
| P5 | Day/Boss/难度曲线 | 🔄 Boss 美术资产 4 个独立包完成，玩法引擎未开始 | Day 状态机、Boss Controller、词缀、精英变体、watchdog 均未实现 |
| P6 | 地图模块 | ⬜ **完全未开始** | 零地图资产、零 `layout_hash` 机制、零预烘焙碰撞/导航管线 |
| P7 | 武器族与命中验证 | 🔄 5 把起始武器美术完成，命中验证引擎仅有基础步枪 | 狙击/冲锋/长矛/剑的专属校验与延迟策略均未实现 |
| P8 | 职业 | 🔄 5 幸存者美术 + 解锁题规则数据完成，技能引擎未做 | 10 个技能、僵尸玩家 4 职业挂件、通用资产（倒地态/复活态/决策态）未做 |
| P9 | 2–8 人合作 | 🔄 信令基础设施完成，玩法层未做 | 救援、5 小时强制休息、暂停配额、真正的 8 人联机压测未做 |
| P10 | 非对称对抗 | ⬜ 未开始 | 僵尸玩家身体/生命数/重生延迟/感染点/Boss 空间预算/令牌全部未实现 |
| P11 | 教学后台集成 | 🔄 主站教师配置 UI 已上线，报告/申诉 UI 未接线 | 教师游戏报告、accommodation UI、班级内非对称配对入口未做 |
| P12 | 治理与结算 | ⬜ 基本未开始（撤销触发器已在主站落地） | 段位计算、日志脱敏白名单、撤销 SLO 实测、申诉/导出/匿名化未做 |
| P13 | 完整内容与发布 | ⬜ 未开始（内容目录已提前完成大半） | 进阶武器 stage3、全部集成测试、灰度发布流程未做 |

**关键判断（写清楚是为了不要重复踩坑）：**

- 这个项目目前是"内容/资产 领先于 引擎"的状态：卡牌 DSL 数据、4 个 Boss 完整美术包、5 名幸存者模型、起始武器模型都已经做了很多，但 `packages/game-core` 里真正跑起来的规则引擎还停留在 P1 水平（房间大厅 + 单一 Thrall + 单一步枪）。**下一步工程重心应该是把已有内容"接线"进引擎，而不是继续堆更多内容或美术**，除非某个引擎系统明确依赖某项缺失的内容（例如 P6 地图模块）。
- P6（地图模块）是全项目唯一一个"零资产、零代码"的阶段，同时计划书自己说它是"工作量最大的一块"。建议尽早排期，否则会成为 P9/P10 联机测试的硬阻塞（Host 与 peer 都需要地图才能测试真实对局）。
- P0 生产部署链路里真正需要用户本人操作的只有 4 件事（批准 migration、创建并授权 DB LOGIN、创建 Vercel 项目、配置 DNS）。其余全部——环境变量配置、实际部署、冒烟测试、DB parity audit、问题修复——都是 AI 可以直接执行的任务，完整流程见 §2.2。这 4 项授权到位后，后续阶段的"发布"环节复用同一套基础设施，不需要重复搭建。

---

## 1. P-1：数据库审计（主站仓库，✅ 已完成）

**状态**：✅ 三份报告齐全，CI 已跑通零失败重放。这是历史记录，不需要重做，但**流程本身是可复用的，未来每次 Production 变更都要重新执行只读部分**。

### 1.1 已完成项（存档记录，不需重做）

- [x] `docs/p1/git_migrations.csv`：全量 migration 文件清单 + SHA-256（`npm run audit:p1:git-migrations` 校验）
- [x] `docs/p1/MIGRATION_DRIFT_REPORT.md`：Git vs. 生产 schema 三方 diff，逐条给出处理决定
- [x] `docs/p1/REPLAY_FAILURES.md`：从零重放问题与修复记录
- [x] `docs/p1/ASSIGNMENT_MODEL_REPORT.md`：确认方案 B（`assignments` / `vocabulary_sets` / `pronunciation_tasks` 三个永久独立父表）
- [x] `docs/p1/STAGING_GAME_UNLOCK_REPORT.md`：Scheme B 历史 staging 审计通过记录
- [x] CI：`.github/workflows/p1-database-audit.yml` 对每个触及 migration 的 PR 做零失败重放 + 快照断言
- [x] `20260815160000_game_phase0_contract.sql` ~ `20260815200000_game_p2p_signaling.sql` 五个 active 游戏 migration 已写好并通过历史 staging 审计（**尚未应用到 Production**，见 P0 §2.2）

### 1.2 后续每次 Production 发布前必须重做的步骤（不是一次性的）

- [ ] 重新导出当前 Production `pg_dump --schema-only --no-owner --no-privileges`，与最新 Git migration 重放结果 diff
- [ ] 列出 exact pending migrations（哪些在 Git 里但还没在 Production 执行）
- [ ] 确认没有新的 `RAISE` 缺 `EXCEPTION`、列名歧义、缺 `SET search_path` 等已知问题类型
- [ ] 产出更新版 preflight 报告，人工审阅后才能进入 P0 §2.2 的 Production 审批步骤

---

## 2. P0：独立仓库与信令基础设施

**前置依赖**：P-1 完成（✅ 已满足）。
**产出物已具备但生产环境未激活**——这是当前最靠前的阻塞点，建议优先处理，因为 P9/P10 的真实联机测试、P11 的教师报告最终都要连到同一套 Production 基础设施。

### 2.1 已完成（代码层面）

- [x] `NingAcademy-Games` 独立 monorepo：`apps/web`（Next.js 16 + Vercel Route Handlers）、`packages/game-core`、`protocol`、`authority`、`content`、`testkit`
- [x] `game` / `game_private` schema 设计（不在 `supabase/config.toml` 的 `api.schemas` 暴露）
- [x] `game_api_owner`（NOLOGIN 对象 owner）/ `games_api`（NOLOGIN 零表权限 group role）角色模型写入 migration
- [x] 六位无歧义房间码、membership、信令 TTL、清理、重连、确定性 Host 选举、topology epoch、Host checkpoint —— 均已在 `20260815200000_game_p2p_signaling.sql` 中定义
- [x] `/redeem` 精确表单 POST、Origin/Fetch Metadata 校验、原子兑换、过期/重放拒绝、`__Host-` 前缀 Cookie（`apps/web/src/app/redeem/route.ts`）
- [x] Games session 校验（`apps/web/src/server/game-session.ts`）
- [x] P2P Route Handlers：create / join / poll+signal / ice（`apps/web/src/app/api/p2p/**`、`apps/web/src/app/api/session/route.ts`）
- [x] WebRTC Host↔peer 星形拓扑，双通道（可靠 `ning-control-v1` + 不可靠 `ning-realtime-v1`）（`apps/web/src/p2p/webrtc-star.ts`、`webrtc-remote-authority.ts`）
- [x] Host 固定步进 30Hz 模拟、约 15Hz snapshot、5 秒检查点持久化（`packages/authority/src/host-p2p-authority.ts`）
- [x] 单元测试 + 8-browser-context Host→7peers Playwright 端到端测试（`scripts/p2p-webrtc.playwright.ts`，`npm run test:p2p-e2e`）
- [x] 旧 `game_server` 角色已在 migration 中收回所有 schema usage / 函数执行权限
- [x] 单人模式完全走 `LocalAuthority`，不建房间/信令/WebRTC（`packages/authority/src/local-authority.ts`）

### 2.2 生产部署 Rollout：用户 4 项授权 → AI 接续完成

> 整条链路只有 **2.2.0** 里的几件事必须由用户本人操作或明确批准：原始 4 件事中的第 1 件（9 个 migration 的批准）已完成，**剩 4 件（1a/2/3/4）待你操作**，见下表。这些就位后，2.2.1–2.2.5（配置→部署→验证→DB parity audit→问题修复）全部由 AI 通过 Supabase MCP 工具（`apply_migration`/`list_migrations`/`execute_sql`/`get_advisors`）、Vercel CLI/API、Cloudflare CLI/API、脚本与测试工具接续执行，不需要用户逐步手动操作。**不要在已批准的清单之外主动扩大 Production 写入范围。**

#### 2.2.0 🚫 用户侧授权（原 4 项中的第 1 项已完成；剩 1a/2/3/4 共 4 项待你操作）

> **需要你本人操作/批准的还有 4 件事：1a、2、3、4。** 除此之外的一切（migration 执行、验证、Vercel/Cloudflare 配置、部署、冒烟测试、parity audit）都是 AI 可以直接做的，不需要等你逐步操作。

1. [x] 🚫 **批准 Production migration**（已完成，2026-08-16）：`20260815160000` ~ `20260815200000` 这 9 个 migration（含 5 个游戏相关）已按文件名顺序应用到 Production——`mcp__supabase__list_migrations` 实测 Production 共 28 个 migration，与 Git 当前 29 条历史中的**前 28 条**逐条匹配；Git 第 29 条（`20260816150000_restrict_rls_auto_enable_execute.sql`，见 1a）是另一个 pending migration，不在这次核对范围内。**注意**：其中 `20260815180000_game_session_identity_v2.sql`、`20260815200000_game_p2p_signaling.sql` 两个文件在最初编写后又经历过 Postgres 17 临时角色成员关系清理的 bug 修复（commit `86a20a4`/`48471fa`/`a0bf694`），实际执行到 Production 上的是哪个版本尚未做逐字节确认，建议在 §2.2.4 parity audit 里一并核对。
   - 验证项：`docs/p1/MIGRATION_DRIFT_REPORT.md`"2026-08-16 Production deployment confirmed"一节记录了这次 spot-check 的范围与限制；**正式的受保护只读 schema/ACL/FK 全量重导出仍未在部署后重跑过**，不能当作已完成的完整 parity audit

1a. [ ] 🚫 **批准新的 `rls_auto_enable()` EXECUTE 收权 migration** ——**只差你批准，其余都已就绪**：Security Advisor 复查发现 `public.rls_auto_enable()`（Supabase Dashboard 自动创建的 RLS 自动启用 event trigger 函数）仍带 PostgreSQL 默认的 PUBLIC EXECUTE，`anon`/`authenticated`/`service_role`/`game_server`/`games_api` 都能直接调用。
    - 已起草 `supabase/migrations/20260816150000_restrict_rls_auto_enable_execute.sql`：只 `revoke execute`，不动函数体/owner/`SECURITY DEFINER`/event trigger；且已改为 `pg_catalog.to_regprocedure()` 判空后再 `execute` 的条件 no-op 写法，不存在该函数的环境（clean replay/CI/本地）安全跳过
    - 2026-08-16 首版曾在 GitHub Actions 上导致 P-1 clean replay 失败（`SQLSTATE 42883 undefined_function`，run #38）；修复后 **run #39（2026-08-17）P-1 replay 已 PASS**
    - **尚未应用到 Production**，需要同样的只读 preflight + 人工批准流程——建议排在步骤 2（创建 `games_api_login`）之前完成，保持权限链从一开始就是干净的
2. [ ] 🚫 **创建并授权受限数据库 LOGIN**：在 Supabase 控制台创建一个可登录、无 owner/service-role 权限的 server-only credential，并执行 `GRANT games_api TO <login>`（不得复用任何现有 owner/service_role 凭据；`games_api` role 已存在，但建议等步骤 1a 的 ACL 收紧 migration 落地后再创建，保持权限链干净）
3. [ ] 🚫 **创建 Games Vercel Production 项目**：创建独立 Vercel Project 并绑定到 `NingAcademy-Games` GitHub 仓库（不可与主站共用同一个 Vercel Project，可以同一个 Vercel Team）——与步骤 1a、2 **无依赖，可并行**
4. [ ] 🚫 **配置正式域名 DNS**：添加 `game.ningacademy.org`（本节）与 `assets.ningacademy.org`（见 §4.3）两条 DNS 记录——与步骤 1a、2、3 **无依赖，可并行**

> 步骤 1 已完成。剩余的 1a/2/3/4 之间除"步骤 2 建议排在步骤 1a 之后"外没有硬顺序，能同时找用户一次性批完就一次性批完，不必逐条等待。

#### 2.2.1 ⬜ AI 自动继续：配置（各条依赖对应的 2.2.0 授权项，授权一到位就能立刻做）

- [x] 用 Supabase MCP `apply_migration`（或主站仓库 CLI）执行已批准的 9 个 migration —— 依赖 2.2.0-1，**只执行该步骤批准的清单**（2026-08-16 完成，Production 28 个版本与 Git 前 28 条逐条匹配；不含 Git 第 29 条 pending migration）
- [ ] ⬜ 用 Supabase MCP `apply_migration` 执行已批准的 `rls_auto_enable()` EXECUTE 收权 migration，然后用 `execute_sql` 复核四个角色的 `has_function_privilege(...)` 均为 `false` 且 `ensure_rls` event trigger 仍存在并启用 —— 依赖 2.2.0-1a
- [ ] ⬜ 用 Supabase MCP `execute_sql` 验证 2.2.0-2 创建的 LOGIN 无表级权限、`SET ROLE games_api` 后只能 `EXECUTE` 白名单 RPC —— 依赖 2.2.0-1a、2.2.0-2
- [ ] ⬜ 用 Vercel CLI/API 在 Games Vercel Project 配置 server-only 环境变量：`GAME_DATABASE_URL`（2.2.0-2 的 LOGIN，Transaction Pooler SSL URL，不进任何 `NEXT_PUBLIC_*`、不提交进 migration/Git，作为纯服务端 secret 单独管理）、`GAME_DATABASE_ROLE=games_api`、`GAME_WEB_ORIGIN=https://game.ningacademy.org`、`NINGACADEMY_MAIN_ORIGIN=https://ningacademy.org`、`GAME_STUN_URLS`、（可选）`GAME_TURN_URLS`/`GAME_TURN_USERNAME`/`GAME_TURN_CREDENTIAL` —— 依赖 2.2.0-2、2.2.0-3
- [ ] ⬜ 用 Vercel CLI/API 确认 `game.ningacademy.org` 域名验证状态并完成 Vercel 侧绑定 —— 依赖 2.2.0-3、2.2.0-4
- [ ] ⬜ 用 Vercel CLI/API 在主站 Vercel Project 配置 `GAME_LAUNCH_EXCHANGE_URL=https://game.ningacademy.org/redeem`，核对主站 CSP `form-action` 已指向该 origin —— 依赖 2.2.0-4

#### 2.2.2 ⬜ AI 部署

- [ ] ⬜ 触发 Games Vercel Project 首次生产构建与部署（`vercel --prod` 或推送到 `main` 触发既有 CI/CD）—— 依赖 2.2.1 全部完成
- [ ] ⬜ 确认构建日志无错误、健康检查通过、`/redeem`、`/api/p2p/**`、`/api/session` 路由均可访问

#### 2.2.3 ⬜ AI 执行验证（生产冒烟测试，脚本/Playwright 化执行）

- [ ] ⬜ 端到端脚本跑通：学生登录主站 → 打开一个已发布的游戏作业 → 拿到 launch ticket → 跳转 `/student/game/launch` → POST 到 `/redeem` → 拿到 `__Host-ning_game_session`
- [ ] ⬜ Games Web 创建房间拿到 6 位房间码，第二个测试账号加入房间，双方完成 ICE 协商，`ning-control-v1` 与 `ning-realtime-v1` 均已 open
- [ ] ⬜ 触发一次答题流程，确认判题走 Games API 而非浏览器本地
- [ ] ⬜ 主站登出后 5 秒内验证 Games session 被拒绝（对照 §14.4 撤销 SLO）
- 依赖：2.2.2 完成

#### 2.2.4 ⬜ AI 做 DB parity audit（复用 P-1 §1.2 流程，通过 Supabase MCP 独立完成，不需要用户重新手动跑一遍）

- [ ] ⬜ 用 Supabase MCP `list_migrations` 核对 Production 已登记版本与 Git migration 清单一致
- [ ] ⬜ 逐字节核对 `20260815180000_game_session_identity_v2.sql`、`20260815200000_game_p2p_signaling.sql` 两个文件——它们在最初部署前又经历过角色清理 bug 修复（见 §2.2.0-1 备注）——确认 Production 上实际生效的函数体/角色语句与当前 Git 版本一致，不是某次中间态
- [ ] ⬜ 用 Supabase MCP `execute_sql` 重新导出 schema 关键对象（表/函数签名/RLS 策略/grant），与 P-1 报告基线 diff
- [ ] ⬜ 用 Supabase MCP `get_advisors` 检查新出现的安全/性能告警
- [ ] ⬜ 产出更新版 parity 报告，追加到 `docs/p1/` 或新的部署审计记录
- 依赖：2.2.1 完成，可与 2.2.2/2.2.3 **并行**

#### 2.2.5 ⬜ AI 修复发现的问题

- [ ] ⬜ 冒烟测试（2.2.3）或 parity audit（2.2.4）发现的代码/配置问题直接修复并重新验证
- [ ] ⬜ 若问题需要新的 Production DDL/DML（例如需要一条 forward-fix migration），AI 写出 migration 草稿，但**执行前必须回到 2.2.0-1 式的人工批准**——不得绕开审批直接对 Production 写入
- [ ] ⬜ 修复记录追加到 `docs/project-status-rev2.1.md`
- 依赖：2.2.3、2.2.4

#### 2.2.6 发布门槛达成

- [ ] ⬜ 2.2.1–2.2.5 全部通过后，把本节状态从"🔄"更新为"✅"，并同步更新 §0 总览表 P0 行状态

### 2.3 P0 测试与验证（代码层面，✅ 大部分已覆盖）

- [x] `npm run check:boundaries`：禁止浏览器代码引用 service-role/Claude 凭据、禁止 game-core 引用框架或浏览器全局、禁止追踪 `.env` 文件
- [x] `npm run test:p2p-e2e`：8 个 Playwright browser context 覆盖 Host→7 peers
- [ ] P2P fixtures 覆盖计划书 §6.1 要求的全部场景：create/join、无效/过期/满房、重复 peer、2–8 容量、membership、信令 TTL/cleanup、Host election、checkpoint 单调性、旧 topology signal 清除 —— **需要确认现有测试是否已覆盖全部子项，逐条补齐缺失用例**
- [ ] 断言：`academic_terms` 排他约束允许同教师跨班级重叠、禁止同教师同班级重叠（主站仓库测试，需核对是否已写）
- [ ] 断言：`game_assignment_versions` 的 `UPDATE`/`DELETE` 被触发器阻止（主站仓库测试，需核对是否已写）

---

## 3. P1：单人核心垂直切片

**前置依赖**：P0 代码层面完成（✅），不要求生产部署完成即可继续开发。
**当前代码**：`packages/game-core/src/combat.ts`（878 行）+ `combat-types.ts` 已实现：平地图占位、单把 hitscan 步枪（`RifleState`：弹药/弹匣/下次开火 tick/换弹完成 tick）、单个 Thrall、Host 30Hz 权威 tick、250ms 命中历史缓冲、200ms rewind 窗口常量（`COMBAT_REWIND_WINDOW_MS`）。

### 3.1 待完成开发项

- [ ] **确认并补齐"拒绝非法输入"的对抗性规则**（计划书 P1 验收标准逐条核对）：
  - [ ] peer 发送瞬移（超出物理可能的位移）指令 → Host 拒绝或裁剪，写单元测试
  - [ ] peer 发送伪造击杀事件（客户端直接声称命中）→ Host 忽略，只信任自己模拟的判定
  - [ ] peer 超射速开火（绕过 `nextFireTick`）→ Host 丢弃超额请求并计数
  - [ ] 无弹药情况下开火请求 → Host 拒绝，不消耗弹药，不产生伤害
  - [ ] peer 尝试直接提交/覆盖权威 world state（而不是 input/intent）→ 协议层拒绝
- [ ] 核对 `CombatRuleErrorCode` 是否已覆盖以上全部拒绝路径（现有：`COMBAT_NOT_STARTED` / `COMBAT_PLAYER_INACTIVE` / `INPUT_EXPIRED` / `INPUT_SEQUENCE_REPLAY` / `INVALID_COMBAT_COMMAND` / `INVALID_MOVEMENT` / `WEAPON_UNAVAILABLE`），缺失的补上

### 3.2 测试与验证（可与 3.1 并行编写）

- [ ] 单元测试：固定种子下 Host 与 `LocalAuthority` 的模拟结果逐 tick 完全一致（确定性回归测试）
- [ ] 单元测试：200ms rewind 窗口边界值（199ms 接受 / 201ms 拒绝或按窗口裁剪）
- [ ] 压力测试：单房间连续运行验证无 tick 漂移 / 无内存泄漏（为后续 30 分钟 VFX soak 测试打基础，见 §17.8）

### 3.3 验收 Gate（对照计划书 P1 行）

- [ ] "peer 只能 input/intent，拒绝权威状态覆盖、瞬移、伪造击杀、超射速和无弹药射击" —— 全部有对应自动化测试且全部通过后，方可进入 P4/P5 的引擎接线工作（P4/P5 会复用同一套 Host 权威校验模式）

---

## 4. P2：Babylon 场景、预测、可访问性、资产管线

**前置依赖**：P1 §3.3 验收 Gate 通过（战斗基础必须先站得住，否则预测/插值无意义）。
**可并行**：本阶段的"可访问性工具链"与"R2 资产管线"两块彼此独立，可以两条线同时推进。

### 4.1 已完成

- [x] `FlashGovernor`（`apps/web/src/lib/flash-governor.ts` + 测试）：全局闪光频率治理
- [x] Hit-stop 预算控制（`hit-stop-budget.ts` + 测试）
- [x] 效果偏好持久化（`effects-preferences.ts` + 测试）：屏幕震动/闪光/碎片/慢动作等玩家可调项
- [x] VFX manifest 加载与校验（`vfx-manifest.ts` + 测试）
- [x] 浏览器能力检测（`browser-capabilities.ts` + 测试）
- [x] IME composition-safe 输入组件（`composition-safe-answer.tsx`）：中文输入法组合期间不误触发提交
- [x] 结晶碎片、弱点核心、护盾半球等 VFX 网格（美术资产已交付，见 §4.4）

### 4.2 待完成开发项 —— 场景与网络预测

- [ ] Babylon.js 场景搭建：加载 `model-asset-registry.ts` 中已注册的静态模型（Thrall / 幸存者 / Boss / 步枪）
- [ ] 客户端预测（client-side prediction）：本地玩家输入立即在本机模拟位移，等待 Host snapshot 校正
- [ ] Reconciliation：收到 Host snapshot 后回滚重放未确认的本地输入
- [ ] 远端玩家插值（remote interpolation）：其他玩家位置基于 15Hz snapshot 平滑插值
- [ ] 手机触控输入：横屏双摇杆、按钮、安全区适配、轻度瞄准减速、小范围可见目标磁吸（明确**不做**自动开火、穿墙锁定）
- [ ] 结晶裂纹/碎裂表现接入 shader（美术已给出裂纹遮罩通道规范，见资产清单 §0.4）
- [ ] **音频总线拆分为 `learning` / `world` 两条**（为 P3 §4.5.3 听力静音做准备，当前代码未发现音频总线实现）

### 4.3 R2 资产管线（AI 可通过 Cloudflare API/`wrangler` CLI 执行，仅域名绑定需要 §2.2.0-4 的 DNS 授权）

- [ ] ⬜ 用 Cloudflare API/`wrangler` CLI 创建四个 R2 bucket：`ning-game-assets`、`ning-game-checkpoints`、`ning-game-replays`、`ning-game-anticheat`
- [ ] ⬜ 为四个 bucket 分别创建**独立**、最小权限的 R2 API token，互不可读
- [ ] ⬜ 把资产（模型/贴图/音频）上传流程接入 CI/发布流程，产出 `asset_manifest_id`
- [ ] ⬜ 目标设备性能门槛验证环境搭建（见 §17.8 性能测试项）
- [ ] 🚫 **仅 `ning-game-assets` 绑定自定义域 `assets.ningacademy.org`**——自定义域 DNS 记录属于 §2.2.0-4 的 4 类授权之一；其余三个 bucket 明确不绑定自定义域、不开公开访问策略（这一条 AI 可以直接配置/断言，不需要用户操作，只有"申请这个域名指向 Cloudflare"这一步需要 DNS 授权）

### 4.4 已完成的美术资产（供工程接入参考，不是待办）

- [x] Boss：4 个（猎袭者/巢群者/疫化者/铁壳者）独立 GLB + blend + manifest + QA report
- [x] 幸存者：5 个职业 GLB（Warrior/Medic/Mage/Assassin/Guardian）+ 1 个 canonical 基准体
- [x] Thrall：1 个基础体 + 4 个生态挂件（房屋/草地/沙漠/地狱，仅 "A" 变体）
- [x] 起始武器：5 把（步枪/冲锋枪/狙击枪/长矛/剑）FP+TP 各一
- [x] 进阶武器链阶段 1/2：光剑、激光枪、等离子炮、元素法杖（阶段 3 见 §11.3 ⚠️ 待设计）
- [x] VFX 网格：结晶碎片（4 生态）、弱点核心、护盾半球、奇点吸引场、地面法阵、区域环等
- [x] 消耗品/部署物：手雷/绷带/急救包/弹药箱、自动炮塔/护盾发生器/减速陷阱/无人机/守卫晶盾
- [x] `WEAPONS_Catalog_v01.json`：51 个已批准武器/道具资产的目录，`scripts/verify-model-assets.mjs` 在 CI 中校验数量、GLB 结构、Boss 独立性声明（`biome_bound=false`、`controllers` 含 AI+Player）、命名规范

### 4.5 测试与验证

- [ ] 预测/reconciliation 单元测试：模拟输入延迟、丢包场景下客户端与 Host 最终收敛一致
- [ ] 目标设备性能门槛：Iris Xe 720p / GTX1650 1080p 帧时预算测试（详见 §17.8，暂缓到有可玩场景后执行）
- [ ] 手机触控 E2E：至少在一台真实中端安卓设备与一台 iOS 设备上验证安全区与摇杆响应

---

## 5. P3：题目系统与听力防泄漏

**前置依赖**：P0 生产信令基础设施可用（判题走 Games API，需要数据库连接）；可与 P2 部分并行（协议层不依赖 Babylon 场景）。

### 5.1 已完成

- [x] 题目协议：`QuestionPresentedMessage`（正确答案结构性不出现在下发数据里）、`SubmitAnswerMessage`、`AnswerGradedMessage`（`packages/protocol/src/learning.ts`）
- [x] IME 安全输入组件（`composition-safe-answer.tsx`）
- [x] 本地练习题库与本地判题（`apps/web/src/practice/local-mock-questions.ts`、`local-practice-authority.ts`）—— 用于未连接数据库时的单机练习
- [x] 教师/学生角色未解锁职业的确认题规则数据（`role-gate.ts`）

### 5.2 待完成开发项 —— 判题与幂等

- [ ] Games API 幂等判题：同一 `question_instance_id` + `request_id` 重复提交返回同一结果，不重复计分（`AnswerGradedMessage.duplicate` 字段已预留，需要接后端持久化）
- [ ] 四类题型的实际出题来源接入：英译中 / 中译英 / 英语听力拼写 / 数学（计算、填空、判断）
- [ ] 错题复习调度：同一 Day 不重复，至少间隔 5 题，按 1/3/7 天复习节奏（不改写首答）
- [ ] accommodation（1×/1.5×/2×/无时限）在题目下发时的时限计算与应用；"无时限"在实时救援中按 2× 处理，其他题目真正无时限
- [ ] 题目隐私：同房不同玩家的题面/答案/Tier/策略互不广播（协议已设计为单播 `QuestionPresentedMessage`，需要在房间广播逻辑里确认真正做到不广播给其他 peer）

### 5.3 待完成开发项 —— §4.5.1 答题保护（当前 game-core 无 Day/Boss 概念，需与 P5 联合开发）

- [ ] 定义"答题窗口"起止时间点（题面下发显示 → 提交或倒计时归零），在 Host tick 层面打标记
- [ ] 窗口内玩家受到伤害 ×0.10（普通敌人/Boss 召唤物）
- [ ] 窗口内 Boss 本体伤害减免 ×0.50，且不开始新的一击致命大招（已在前摇中的不打断）
- [ ] 倒计时结束 = `question_window_closed_tick`，下一 tick **立即**恢复 100%，无渐变——写逐 tick 断言测试
- [ ] 三种答题场合（卡牌题/救援题/`DAY_START` 保底题）统一走这一套规则
- [ ] `S023` 救援场合叠乘 0.88 的特殊系数（依赖卡牌引擎，见 P4）
- [ ] 答题保护事件写入领域事件与检查点，供回放验证

### 5.4 待完成开发项 —— §4.5.3 听力静音（world/learning 双总线）

- [ ] 音频总线拆分实现（依赖 P2 §4.2 的 `learning`/`world` 总线基础设施）
- [ ] 听力题播放期间：`world` 总线增益归零 + 暂停所有一次性音效实例的调度（不是降低音量）
- [ ] 播放结束 200ms 淡入恢复；期间被抑制的音效**不补播**
- [ ] 确认这是纯本地表现层行为，不影响 Host 时钟/伤害判定/AI/配额（写测试验证暂停音频时 Host tick 仍在推进）
- [ ] 视觉信息（字幕/命中提示/弱点轮廓）在静音期间正常显示

### 5.5 待完成 —— 听力音频管线（消除答案泄露信道，§4.8.2；AI 可通过代码+Cloudflare CLI 执行，仅生产自定义域路由依赖 §4.3 的 DNS 授权）

- [ ] ⬜ 对象 key 生成：`base32(HMAC-SHA256(content_release_salt, word_id || voice_id || variant))[0:32]`
- [ ] ⬜ `content_release_salt` 只存在于 `game_private`，每次内容发布轮换，不进客户端、不进 CI 制品
- [ ] ⬜ 短时签名 URL（TTL 90 秒）绑定 `question_instance_id` 与游戏会话
- [ ] ⬜ 用 `wrangler` CLI 开发并部署 Cloudflare Worker 代理音频请求，校验会话 Cookie 与 `question_instance` 归属后才回源；R2 音频 bucket 本身不公开、无自定义域（Worker 代码开发与部署是 AI 可执行任务；若生产路由挂在 `assets.ningacademy.org` 下，需要该域名已完成 §4.3 的 DNS 绑定，绑定本身是 🚫 项，Worker 部署不是）
- [ ] ⬜ 同一次发布内，同一个词对不同学生随机下发 3 个语音变体之一
- [ ] ⬜ 审计：同一学生对同一 `question_instance_id` 最多请求 3 次音频，超出记反作弊标记
- [ ] ⬜ 正式听力音频批处理管线：固定 Kokoro-82M v1.0 本地批处理生成 + Opus 转码（脚本化，AI 可执行）；**人工抽检音频质量**是 ⚠️ 内容审校环节（听感判断，不是平台操作权限问题），不因此把整条流水线标 🚫（自由练习用 `SpeechSynthesis`，不走 R2）
- [ ] ⬜ 确认全程无麦克风权限、录音上传、Speech Recognition、语音输入、朗读复活（`check:boundaries` 已经在拦截 `MediaRecorder`/`SpeechRecognition`/`getUserMedia`，✅ 已有防线，保持）
- [ ] ⬜ 听力改文本（`text_alternative`）标记，不计入听力/段位正确率，教师报告单列

### 5.6 测试与验证（对照计划书 §6.2 "听力泄露"）

- [ ] 同一词跨两次 `content_release` 的对象 key 必须不同
- [ ] 直接访问 R2 音频 bucket 必须 403
- [ ] 过期签名 URL 必须 403
- [ ] 同一 `question_instance_id` 第 4 次音频请求触发反作弊标记
- [ ] 答题保护逐 tick 断言：窗口内伤害精确等于 10%/50%，`question_window_closed_tick` 后下一 tick 精确恢复 100%
- [ ] 听力静音断言：播放期间 `world` 总线增益为 0 且无新一次性音效实例；结束 200ms 内恢复；被抑制音效不补播

---

## 6. P4：卡牌 DSL 与内容引擎接线

**前置依赖**：P1 §3.3 Gate 通过。**这是当前最值得优先投入的阶段**——内容数据已经领先，只差把 260 张卡的 `effects`/`activationPolicies`/`acquisition` 接进 game-core 的 reducer。

### 6.1 已完成

- [x] 卡牌 DSL Zod schema（`packages/content/src/schema.ts`）：`CardDefinitionSchema` 覆盖稳定 ID、双语、版本、rarity、min_day、权重、机制槽、trigger/target/effect operation、`CheckpointMetadataSchema`（对应计划书 §3.7.5 统一 `card_state`）、`VisibilityMetadataSchema`、`AccessibilityMetadataSchema`
- [x] 260/262 张卡数据已授权（S001–S160 全，Z001–Z100 全）
- [x] `EngineRuleImplementationStatusSchema`：每条卡效果显式声明 `implemented`（带 `engine://S001` 式引用）或 `blocked`（带原因）—— 这是一个很好的"内容先行、引擎滞后"追踪机制，**应该被用来生成本节剩余待办的权威清单**
- [x] `AntiAbusePolicySchema` / `BossBudgetPolicySchema` / `CausalRewriteOperationSchema`（S159）/ `NormalizedOverrideSchema` 等特殊卡约束的数据结构已就位
- [x] `packages/content/test/full-catalog.test.ts`：目录级测试存在

### 6.2 ⚠️ 待完成 —— 内容缺口

- [ ] **补齐 `S161 聚变激光` 卡数据**（钻石，需 S045，激光伤害+25%/热量增长-20%/弱点命中散热，`S075` 改为需要 `S161`）—— 对应的美术模型（`fusion_laser` FP/TP）已存在，只差卡数据
- [ ] **补齐 `S162 奇点等离子炮` 卡数据**（黑金，需 S063，命中产生 4 米吸引 2 秒后 240 等离子爆发，内部冷却 30 秒）—— 对应美术模型（`singularity_plasma`）已存在

### 6.3 待完成开发项 —— 运行时引擎接线（game-core 目前完全没有卡牌概念）

- [ ] 在 `GameState` 中新增卡牌相关字段：每玩家已获得卡牌列表、机制槽占用状态（幸存者每人 6 槽，僵尸阵营共享 6 槽）、`card_state`（4×i32 + 4×f32，对照 schema 的 `CheckpointMetadataSchema`）
- [ ] 三选一抽取逻辑：三张候选不同、非法/冲突/满栈卡过滤、重复数值卡权重 `base/(1+stacks)`
- [ ] 抽取概率表按 Day 分档（§4.7.1 表格）接入，**并写 CI 断言：每行合计必须 = 100**（当前未确认此断言是否已存在，需要补）
- [ ] 过滤为空时的自动重算与"本次机会结束"退化路径
- [ ] 选卡→发题→原子应用/失效的完整流程（依赖 P3 判题接线）
- [ ] 答错扣 10 点非致死真实伤害（最多降到 1 HP，不能致死）的伤害管线
- [ ] **膨胀控制**（计划书明确标注 rev1 缺失）：
  - [ ] 常驻被动总数上限 24（机制槽 6 + 数值/武器/消耗品被动 18）
  - [ ] 每张卡最大层数 5
  - [ ] 堆叠结算顺序：同类加法先合并 → 乘法按类别顺序（职业→卡牌→临时增益→环境）→ 套用硬上限
  - [ ] 同类乘法收益递减公式：`1 + Σ( effect_i / (1 + 0.15 × i) )`，按 `card_id` 升序排序保证确定性
  - [ ] proc 预算：默认不可重触发来源效果、最大链深 4、单根事件最多 32 派生效果、每 tick 每房间 ≤512 派生效果
  - [ ] 每 tick CPU 预算 3ms（30Hz 下 tick 预算 33.3ms 的 9%）
  - [ ] 超预算确定性丢弃顺序：纯视觉→非伤害辅助→低优先级 DoT 刷新→数值 proc；同优先级按 `(priority_class, card_id, source_entity_id)` 三元组升序丢弃；每次丢弃记录 `proc_budget_exceeded` 事件
  - [ ] 事件索引预编译，禁止每 tick 扫描 262 张卡（性能要求）
- [ ] 获取节奏：首 5 次成功获得卡牌每次需 10 贡献点，之后每累计 5 次门槛 +5，最高 50；贡献来源含反刷上限
- [ ] 特殊卡约束逐条接线：`Z093`（Boss 双星拆分固定 Boss 预算）、`Z084`（分魂清场）、`S121`（同对手/同 Day 反刷）、死亡保护优先级（S139→S148→S070→S078→S160）、`S159 因果改写`（见下）
- [ ] `S159` 完整实现：每局一次、原始错误记录标记 `causally_voided` 不删除、从"最近 70 道"窗口整条剔除不占位、不进段位/正确率聚合、使用门槛（本局正式题总数 ≥10）

### 6.4 开发顺序（计划书 §4.7.5，用于分批验证）

- [ ] 20 张代表卡覆盖全部原子操作类型的最小实现
- [ ] 显式混合稀有度的 60 张幸存者 + 50 张僵尸内部池跑通
- [ ] 完整 162 + 100（含补齐的 S161/S162）全部通过组合测试

### 6.5 测试与验证

- [ ] 262 个稳定 ID 连续唯一、全部前置存在且无环（图算法测试）
- [ ] 概率表每行合计 = 100（CI 断言，策划表/测试断言/UI 显示三处共用同一份数据文件）
- [ ] 每个模式/Day/生态/职业都有合法三选一或明确空池终止路径
- [ ] 每张卡状态能装进统一 `card_state`，超出即构建失败
- [ ] 固定种子事件回放：伤害顺序、卡牌硬上限、被动总数上限、收益递减合并、proc/CPU 预算与确定性丢弃顺序，Host 与 `LocalAuthority` 结果一致

---

## 7. P5：Day、地图占位、Boss 与难度曲线

**前置依赖**：P4 卡牌引擎基本接线完成（Day 状态机需要在 `ZOMBIE_CARD` 节点调用卡牌系统）。**Boss 美术资产已就绪，不阻塞引擎开发。**

### 7.1 已完成 —— Boss 美术资产（独立性已通过 CI 校验）

- [x] 4 个 Boss（猎袭者 Hunter / 巢群者 Swarm / 疫化者 Plague / 铁壳者 IronShell）各自独立 GLB + Skeleton + 动画 + 材质 + manifest + QA report，**零共享母体**
- [x] `scripts/verify-model-assets.mjs` 已经在 CI 里校验：
  - [x] 每个 Boss manifest 显式声明 `biome_bound=false`
  - [x] 每个 Boss manifest 声明 `controllers` 数组同时包含 `AIController` 与 `PlayerController`
  - [x] 每个 GLB 内部节点/动画/材质命名唯一，外部 URI 不逃逸出 `models` 根目录
  - [x] 警告（非阻塞）：可破坏部件少于 3 个时报警
- [ ] **待加强**：当前校验是"每个 Boss 自查"，没有做真正的"跨 Boss 资产依赖图断言"（即没有直接证明 Boss A 的贴图/骨骼文件没有被 Boss B 引用）。建议在 `verify-model-assets.mjs` 里加一条：收集四个 Boss 各自引用的外部 URI 集合，断言两两不相交

### 7.2 待完成开发项 —— Day 状态机（game-core 目前完全没有 Day 概念）

- [ ] 在 `GameState` 新增 Day 相关字段：当前 Day、equivalentDay（按地图系数换算）、当前状态机节点、普通怪配额进度、僵尸卡历史
- [ ] 实现固定状态机：`DAY_START → ZOMBIE_CARD → QUOTA_COMBAT → QUOTA_CLEANUP → BOSS_TRANSITION → BOSS_COMBAT → SUMMON_CLEANUP → RESCUE_RESOLUTION → DAY_END_CHECKPOINT`
- [ ] `DAY_START` 保底正式题：每 Day 固定下发 1 道正式限时题，与卡牌完全解耦，答对无奖励/答错不扣血只记录，计入作业最低题量与段位正确率（依赖 P3 判题接线）
- [ ] 普通怪配额：Day 1 配额 30，每 Day +5，Day 20 封顶；四地图敌对实体上限（房屋 20/草地 30/沙漠 40/地狱 50）
- [ ] `equivalentDay = floor(1 + (actualDay - 1) × 地图系数)`（房屋 0.8/草地 1.0/沙漠 1.2/地狱 1.5）
- [ ] PvE 每 Day Host 从合法僵尸卡随机选一张，100% 成功应用全体敌人（依赖 P4）
- [ ] 配额完成即停止普通重生和全部召唤；清理剩余普通体后进入 Boss

### 7.3 待完成开发项 —— Day 20+ 成长轴（不占机制槽、不受数值上限约束）

- [ ] Boss 词缀 `boss_affix`：Day 20 起每 5 Day 解锁 1 个，最多 6 个；词缀池（额外阶段/召唤节奏改变/地形交互/技能组合/针对救援/护盾相位）
- [ ] 词缀由 Host 按 Day、match seed 与 `boss_id` 确定性抽取，不按地图生态筛选
- [ ] 精英变体配额比例：`min(30%, 5% + 1.5% × (Day-20))`，Day 37 达 30% 上限；精英是不同行为模板（护盾型/爆裂型/牵引型/干扰型），计入配额与实体上限
- [ ] ⚠️ **词缀视觉附件资产待美术制作**：4 个 Boss × 6 组 = 24 组专属词缀视觉附件，资产清单已给出规格（§3.5），需要排期委托美术

### 7.4 待完成开发项 —— Boss 战斗与控制器

- [ ] `AIController`：4 个 Boss 均需支持 PvE AI 控制，含移动/普攻/技能/受击/阶段破坏/死亡状态机
- [ ] `PlayerController`：4 个 Boss 均需支持玩家操控（依赖 P10 非对称，这里先实现单机 PvE 路径）
- [ ] Controller 切换不改变 `boss_asset_id`（断线 AI 接管、重连切回 Player，全程同一 GLB）
- [ ] Boss 死亡前召唤物清场：50% HP/50% 伤害/100% 速度，不计配额/卡牌进度/掉落/感染点
- [ ] Boss 死亡后仍倒地玩家可继续被救援（依赖 P9 救援系统）
- [ ] Boss 场地形空间验证：4 Boss × 4 地图 = 16 组 smoke test（依赖 P6 地图模块）

### 7.5 待完成开发项 —— Watchdog

- [ ] 普通阶段 90 秒无进度触发重寻路/迁移，180 秒替换不可达实体
- [ ] 普通阶段、Boss、召唤清场分别有版本化 watchdog
- [ ] 管理员保存后终止异常房间的操作入口（后台工具，见 P12）

### 7.6 测试与验证

- [ ] Boss 共享预算、大招/控制令牌同 tick 争用的确定性胜者（依赖 P10 §10.4）
- [ ] Boss 资产独立性构建时依赖图断言（见 §7.1 待加强项）
- [ ] Boss 地图解耦：4 Boss × 4 生态全部完成 AI 生成 smoke test，不允许用 biome 过滤 Boss 池
- [ ] Boss 双控制模式：4 个 Boss 分别以 AIController 与 PlayerController 跑通全部动作，断线 AI 接管与重连恢复 Player 时 `boss_asset_id` 必须不变
- [ ] 空合法卡池、死亡保护优先级、`S159` 补偿与窗口剔除、`S160` 团灭、watchdog、五小时恢复
- [ ] `bossScale`：故意送死路径必须得到 0.7，正常发挥路径必须得到 1.0（依赖 P10）
- [ ] 连续 10 Day 无卡死（长时间稳定性测试）

---

## 8. P6：地图模块（⬜ 完全未开始 —— 重点关注）

**前置依赖**：无强依赖，**可以立即开始**，且不依赖 P4/P5 引擎进度。**强烈建议尽早排期**，因为 P9/P10 的联机压测、P5 的 Boss 场空间验证都需要真实地图才能测试，目前这些测试项事实上被 P6 阻塞。

### 8.1 ⚠️ 待设计 —— 先定规范（计划书原文强调"规范没定就开工，P6 会全部返工"）

- [ ] 确定网格规范：单格 8m × 8m，墙高 4m，门洞宽 2.4m × 高 2.8m，连接口居中、同一尺寸同一高度同一朝向
- [ ] 确定 trim sheet 贴图规范：每生态 2×2048 共享贴图
- [ ] 确定碰撞体与 navmesh 的预烘焙工具链（Blender 导出规范，需要和现有 `build_boss_assets.py` / `build_weapon_assets.py` 的资产管线保持一致）
- [ ] 确定 `layout_hash` 计算算法与校验时机

### 8.2 待制作 —— 每生态至少 4 类模块（房间/走廊/开阔地/Boss 场），实际约 12–16 个模块/生态

- [ ] **房屋**（简单，同屏 20 敌）：走廊（直/L/T/十字）、房间（卧室/客厅/厨房/储藏间）、楼梯间、**可动的门**（封门环境事件需要）、Boss 场（大厅/中庭）、**可熄灭的灯具**（停电事件需要）、警报器
- [ ] **草地**（普通，同屏 30 敌）：开放地形块、树林块（5–6 种树）、可破坏围栏段、小型建筑（谷仓/棚屋/水塔）、Boss 场（开阔平地+环形遮挡）、可燃草地贴片（草地火线事件）
- [ ] **沙漠**（困难，同屏 40 敌）：沙丘块（注意可攀爬性）、遗迹块（断柱/残墙/拱门）、峡谷段、低掩体、Boss 场（遗迹广场）、流沙区地面下陷网格
- [ ] **地狱**（地狱难度，同屏 50 敌，**面数需压到其他生态 70%**）：熔岩裂隙发光地面、祭坛（Boss 场核心）、窄桥梁、洞穴段、喷发口网格
- [ ] 四生态通用功能物件（每个都要做，四生态各一套外观）：玩家出生区标识、僵尸 spawn zone 标识（仅僵尸阵营可见）、安全复活点（含 8 米禁入范围可视化）、补给点（未开/开启中/已空三态）、目标点（进度环挂点）、危险区边界

### 8.3 待完成开发项 —— 生成器与校验

- [ ] 模块化预制布局组合生成器：只决定"哪个预制模块放在整数网格哪一格、朝哪个方向（0/90/180/270）"，不生成几何体
- [ ] Host 保存并下发的地图元数据结构：`seed / generator_version / canonical_layout_id / collision_layout_id / layout_hash / asset_manifest_id / module_placements[]`
- [ ] peer 端 `layout_hash` 本地计算与比对，不一致时拒绝进入并提示"资源版本不匹配，请刷新"（**不允许降级进入**）
- [ ] `generator_version` 递增机制，旧存档在支持窗口内继续用旧版本模块包（对照 §3.7.4 current/N-1 约束）
- [ ] 发布前自动验证脚本：连通性、导航可达性、出生点合法性、Boss 场空间、安全复活点、资源预算（大厅 ≤15MB、选定生态 ≤50–60MB、完整生态 ≤80MB、手机低档 ≤45MB）

### 8.4 测试与验证

- [ ] `layout_hash` 不匹配必须拒绝进入，不得降级进入（网络测试项，对照 §6.4）
- [ ] 连通性/导航可达/出生点/Boss 场空间/安全复活点/资源预算自动验证全部通过
- [ ] 四生态视觉风格逐一人工评审（形状/裂纹/音色差异，不能只换颜色）

---

## 9. P7：武器族与命中验证

**前置依赖**：P1 §3.3 Gate 通过（复用同一套 Host 权威校验模式）。可与 P4/P5/P6 **并行**开发（武器命中逻辑相对独立）。

### 9.1 已完成 —— 武器美术资产

- [x] 5 把初始武器 FP+TP：狙击枪、冲锋枪、突击步枪、长矛、剑
- [x] 狙击枪镜片独立网格+材质（ADS 渲染镜内画面）已按规格制作（需人工核对最终 GLB 是否满足此要求）
- [x] 进阶武器链阶段 1/2 模型：光剑（原型/完整体两阶段+完全体三阶段均已交付）、激光枪（基础+Fusion 两阶段）、等离子炮（基础+Singularity 两阶段）、元素法杖（基础+奇点两阶段）

### 9.2 待完成开发项 —— 分武器族命中验证引擎（当前 game-core 仅实现基础 hitscan 单发步枪）

- [ ] **狙击枪**：hitscan 单发；Host 校验 ADS 时长、移动速度、开火间隔、后坐恢复；200ms rewind
- [ ] **突击步枪**：hitscan 连发；射速节流；**扩散状态机由 Host 权威计算**，peer 只做视觉预测；Host 最多 200ms rewind（当前 `RifleState` 已有基础字段，需要扩展扩散状态机）
- [ ] **冲锋枪**：hitscan 高射速；peer 每 tick 最多 2 发；Host 按射速上限裁剪，超出丢弃并计数；Host 最多 200ms rewind
- [ ] **长矛/剑**：胶囊扫掠命中；**不使用 rewind**——Host 在 300ms 攻击窗口内按自身权威位置插值判定；peer 只播放动画，命中一律等 Host 确认
- [ ] **格挡**：状态区间；Host 记录格挡开始/结束 tick，伤害结算按 Host 区间判定；不接受 peer"我当时在格挡"的本地声明
- [ ] 武器槽与升级：默认一个主武器槽（`S076` 增加第二槽，依赖 P4）；同链升级原位替换并继承链被动；跨家族旧武器进局内个人兵器库，只能在 Day 边界更换；3 个消耗品槽 + 1 个部署物槽
- [ ] 伤害结算管线：基础伤害→弱点→暴击→攻击方/卡牌→元素抗性→格挡→护甲→HP→状态；暴击/弱点各 1.5 倍组合上限 2.5 倍；元素抗性 ±50%；同类 DoT 最多 5 层；CC 递减规则（普通 2 秒后递减，僵尸玩家 CC ×0.5 单次最多 1 秒，Boss 用韧性条）

### 9.3 ⚠️ 待设计决策 —— 进阶武器阶段 3

- [ ] `laser_stage3`（对应 `S161`）：需要设计给出具体规格，当前只有 `SPEC_PENDING.md` 占位
- [ ] `plasma_stage3`（对应 `S162`）：同上，需要设计规格
- [ ] `staff_stage3`：同上，需要设计规格（若计划书未明确要求法杖三阶段，需先确认是否真的需要，避免过度制作）
- [ ] 三条阶段 3 规格明确后，委托美术制作，再补齐对应 §6.2 的卡牌数据

### 9.4 测试与验证（依赖开发项完成后，需要人工评审环节）

- [ ] P7 阶段人工评审：在 0/75/150/200ms 延迟下分别录制近战手感，人工评审是否可接受（**这是一个必须有人坐下来试玩打分的环节，不能纯自动化**）
- [ ] 近战 200ms 下不得出现"peer 本地结算伤害、Host 拒绝"的体验，只能预测表现动画
- [ ] 武器族分别的对抗性测试（超射速、伪造命中、格挡时间伪造）逐族补齐

---

## 10. P8：职业

**前置依赖**：P7 武器族命中验证基本完成（技能大多与武器/伤害管线交互）；P4 卡牌引擎完成（职业解锁走卡牌/答题流程）。

### 10.1 已完成

- [x] 5 名幸存者角色美术（Warrior/Medic/Mage/Assassin/Guardian）
- [x] 职业解锁答题规则数据（`role-gate.ts`）：首个免费，其他需 10 题 ≥60% 首答正确率；已解锁职业每次开局需 1 道确认题

### 10.2 待完成开发项 —— 幸存者技能引擎（当前完全未实现）

共同基准 100 HP/20 护甲，5 职业各 2 个主动技能，逐一实现：

- [ ] 战士：105HP/22 护甲/武器近战伤害+5%；8 米战吼（队伍伤害+12%、换弹近战速度+10%，6 秒/45 秒）；6 米震荡锥（60 伤害、AI 硬直 0.6 秒，25 秒）
- [ ] 医疗：治疗+10%/武器伤害-3%；8 米治疗脉冲（4 秒恢复 20% 最大生命，45 秒）；6 米救援屏障（减伤 30%，8 秒/60 秒）
- [ ] 法师：95HP/18 护甲/技能状态伤害+5%/武器伤害-3%；四目标递减奥术跳跃（20 秒）；6 米冰霜领域（6 秒，AI 减速 35%/玩家体 15%/Boss 10%，35 秒）
- [ ] 刺客：95HP/18 护甲/移速弱点近战+5%；6 米 Host 权威扫掠突进（无无敌，12 秒）；弱点标记（10 秒，队伍弱点+15%/Boss+8%，35 秒）
- [ ] 守卫：110HP/30 护甲/伤害移速-3%；**晶盾（改）**：180 HP 可破坏部署物，每秒衰减 12HP，最长 8 秒，冷却 45 秒，只挡投射物/近战不挡 Boss 大招与范围地面效果，同时在场最多 1 个，盾破时 2 秒 15% 减伤补偿；8 米 AI 挑衅（4 秒并自身减伤 20%，冷却 35 秒）

### 10.3 待完成开发项 —— 幸存者通用资产（⚠️ 美术待制作，资产清单 §1.6 已给规格）

- [ ] 第一人称手臂：1 套骨骼 + 5 套手部/前臂网格（对应 5 职业手套/护腕）
- [ ] 倒地待救援态：姿势+材质态（单膝跪地低头+淡色结晶纹材质参数），头顶 HUD 图标 socket，**不能有血/不能是仰面尸体**
- [ ] 复活保护态：半透明轮廓材质态（不需要新几何）
- [ ] 决策态（选卡中）：低头看卡姿势 + 头顶 3D 卡牌图标挂点

### 10.4 待完成开发项 —— 僵尸玩家 4 职业（依赖 P10 非对称，此处先做职业差异化引擎部分）

- [ ] 猎袭者：HP-3%/移速近战+3%；6 米飞扑（下一击+25%，12 秒）；15 米狩猎标记（6 秒僵尸伤害+6%，25 秒）
- [ ] 巢群者：直接伤害-5%；召唤轮盘（基础体 10 感染点/特殊体 20，20 秒冷却，最多 4 只）；10 米 AI 移速攻速+10%（6 秒/30 秒）
- [ ] 疫化者：HP-3%/能力伤害+5%；18 米腐蚀投射物（14 秒）；4 米污染区（6 秒每秒 8 伤害且治疗-10%，28 秒）
- [ ] 铁壳者：HP+5%/移速-3%；7 米冲撞（120% 近战伤害+击退+0.4 秒硬直，16 秒）；前方 120° 减伤 30%（4 秒/22 秒）
- [ ] 僵尸玩家相对同模板 AI 基础 HP/伤害/速度各+5%；最终总加成硬上限（含职业与卡牌）：HP+35%/伤害+25%/速度+20%
- [ ] ⚠️ 僵尸玩家职业挂件美术（猎袭者背部折叠晶刺、巢群者卵囊团 3 级 LOD、疫化者半液体晶体、铁壳者正背差异甲壳）待制作，资产清单 §2.5 已给规格
- [ ] ⚠️ 玩家控制统一标识（头顶/胸口发光标记，区分玩家与 AI）待制作

### 10.5 测试与验证

- [ ] 每个职业技能的独立单元测试（数值、冷却、范围）
- [ ] 永久解锁题与每局确认题的完整流程测试
- [ ] 守卫晶盾按新数值验收：180HP、每秒衰减 12、不挡 Boss 大招与地面效果、破盾补偿

---

## 11. P9：2–8 人合作

**前置依赖**：P6 地图模块（真实联机测试需要地图）+ P5 Day/Boss 引擎基本可用 + P7/P8 基础战斗可用。信令基础设施（P0）已就绪。

### 11.1 已完成 —— 信令与拓扑层

- [x] Host + 最多 7 peers 星形拓扑
- [x] 独立 ACL 校验（作业局校验 `assignment_targets`，自由局校验邀请 ACL/同班级）—— 需要核对是否已在 `join_p2p_room_v1` 完整实现（见 §16.1 安全检查）
- [x] ready/start 流程
- [x] 180 秒重连窗口（membership 层面）
- [x] 5 秒检查点持久化
- [x] 确定性 Host election（按 `joined_at, member_id`）、topology epoch 重连
- [x] 8-browser Playwright 测试覆盖上述拓扑层

### 11.2 待完成开发项 —— 合作玩法层（当前 game-core 无多人 Day 共享状态）

- [ ] Day 状态在多人房间内共享推进（依赖 P5 Day 状态机扩展到多玩家）
- [ ] 救援系统完整实现（详见 §11.3，工作量较大，单列）
- [ ] checkpoint restore 失败时的安全终止路径（不假装成功恢复，明确提示用户）
- [ ] 5 小时强制休息：每 5 小时连续游玩，Host 检查点后展示"休息一下吧，已经玩很久了"并强制退出；认证/休息租约/重连/Host 心跳时钟**不**因暂停/慢动作/cinematics 而暂停
- [ ] 多人暂停配额系统（详见 §11.4）

### 11.3 待完成开发项 —— 救援系统（计划书 §4.6，rev2 重新设计的计时模型）

- [ ] 救援参数计算：`maxQuestions = streakRequired + tolerance`；`perQuestion = 学习难度限时(25/18/12秒) × accommodation`；`watchdogWindow = maxQuestions × perQuestion × 1.15`
- [ ] 按地图的连对要求/成长/上限/容错次数/每 Day 可被救援次数表（房屋 2→+1/10Day→上限4，容错3，可救3次；草地同；沙漠 3→上限5，容错2，可救2次；地狱同）
- [ ] 答错清零连对、消耗一次容错，不扣血；容错耗尽或 watchdog 触发→救援失败
- [ ] **Claim 租约三条互不重叠的释放路径**：
  - [ ] 立即释放（救援者死亡/倒地/RTCDataChannel 关闭/3 秒无 Host 心跳/主动取消/被救者永久死亡）→ Host 检测后 ≤500ms 释放
  - [ ] 无活动释放（8 秒内无提交答案也无 `typing` 心跳）→ 8 秒 ±0.5 秒释放
  - [ ] 总占用上限（45 秒 × accommodation，最高×2→90 秒）→ 强制释放
  - [ ] 续租规则：每提交一次答案或每 2 秒一次 `typing` 心跳续租，但总占用仍受上限约束
  - [ ] Claim 授予后 5 秒内必须开始第一题，否则按"无活动"释放
  - [ ] 暂停期间租约与总占用一并冻结
- [ ] **接管与投票规则**：可行动队友=1（含 2 人房）自动持锁无需投票；≥3 名可行动队友才启用投票接管（≥2 票且严格多数）；=2 名不投票，持有者放弃立即转移给第一个请求者；任何人数下持有者主动放弃立即转移；2 人房唯一队友无法行动→直接永久死亡判定
- [ ] 救援结算：救援者不能移动/攻击、无无敌，答题窗口内伤害 10%（依赖 P3 答题保护）再乘 `S023` 的 0.88；成功后安全导航点 30% HP 复活，保护期 `3+1×(僵尸玩家数-1)` 秒（上限 6 秒），不能攻击、无碰撞，保留武器和已生效卡
- [ ] 单人没有普通自救，只有明确的复活卡（依赖 P4）
- [ ] 永久死亡：删除该玩家续玩资格但保留历史与学习记录；团灭删除房间续玩存档

### 11.4 待完成开发项 —— 全体同步暂停（计划书 §4.5.2）

- [ ] `REQUEST_PAUSE` → Host 广播 `PAUSE_GRANTED { requester, expires_at_tick }`，所有 peer 同一 tick 冻结
- [ ] 冻结范围：战斗时钟/题目时钟/救援时钟与租约/Boss 时钟/配额/生成/AI/卡牌冷却/暂停配额本身
- [ ] 不冻结：5 小时墙钟/认证与会话轮换/健康检查/断线检测/检查点心跳
- [ ] 暂停期间禁止：移动/开火/换弹/拾取/使用技能/选卡/提交答案，输入一律丢弃
- [ ] 题目防偷看：暂停瞬间题面隐藏并冻结计时；恢复时该题作废、改发等价新题、倒计时完整重置；作废不计错不扣血，但记录 `paused_during_question`
- [ ] 配额表（按地图：房屋 6 次/局 1 次/人/Day 120 秒单次 300 秒累计；草地 5 次；沙漠 4 次 90 秒/240 秒；地狱 3 次 90 秒/240 秒）
- [ ] 单人模式随时可暂停不消耗配额，5 小时墙钟仍不冻结
- [ ] 恢复：`REQUEST_RESUME` 全员同意或到 `expires_at_tick` 自动恢复，恢复前 3 秒倒数提示
- [ ] 防规避：Boss 大招前摇 1.5 秒内锁定暂停请求
- [ ] 非对称：僵尸玩家配额独立，规则相同
- [ ] `pause_seconds_total` 计入教师报告"用时"列，不计入学习正确率/段位

### 11.5 测试与验证（对照计划书 §6.4/§6.5/§6.9）

- [ ] 两个客户端同时抢救援锁只能一人成功
- [ ] 三条释放路径分别验证：断线/死亡 p95 ≤500ms；无活动 8 秒±0.5 秒；总占用 45 秒×accommodation 强制释放
- [ ] 1.5×/2× accommodation 不允许无限占锁，且每题节奏在 1×/1.5×/2× 下比例一致
- [ ] 2 人房：唯一队友自动持锁无投票；倒地直接永久死亡判定
- [ ] 3–8 人房：投票接管需 2/3 票严格多数；持有者放弃立即转移
- [ ] 救援次数上限达成后再次倒地必须直接永久死亡判定
- [ ] 地狱 Day 1 与 Day 16 实际每题秒数分别为 12 秒（1×），不得出现 rev1 式的 5 秒/1.7 秒问题
- [ ] 暂停：期间题面隐藏计时冻结、恢复后换新题倒计时重置、Boss 大招前摇 1.5 秒内暂停请求被拒绝、配额耗尽后请求被拒绝
- [ ] 网络测试：0/75/150/200ms RTT、jitter、2% 丢包与旧 snapshot 积压；预测关闭时 peer 必须与 Host 一致；覆盖 peer disconnect/reconnect、Host disconnect/election、7 条连接的 8 人房、checkpoint restore、migration 失败安全终止、STUN-only 失败提示
- [ ] 负载：目标 30 并发参与者；45/60/90 人压测 Supabase 短时信令与 Games API；2/4/8 人房 Host 浏览器分别 soak，8 人房 Host 必须只有 7 条 peer connection
- [ ] R2 用量：8 小时 60 CCU 压测后 `checkpoints`+`replays` 总占用 ≤2GB，验证 lifecycle 到期删除生效

---

## 12. P10：非对称对抗

**前置依赖**：P9 合作玩法（救援/暂停）完成 + P5 Boss 引擎完成 + P8 职业引擎完成。**不新增 Boss 模型**，直接复用 P5 的 4 个 Boss 接 `PlayerController`。

### 12.1 待完成开发项 —— 僵尸玩家身体与生命

- [ ] 每 Day 生命数：`min(20, 3 + floor((Day-1)/3))`
- [ ] 重生延迟：第 1–4 次死亡后 8 秒；第 5 次起每次 +2 秒，上限 20 秒
- [ ] 生命耗尽后观战到 Boss 阶段，仍进入对应全局 Boss，但强度按 `bossScale = 0.7 + 0.3 × min(1, dayContribution/dayContributionTarget)` 缩放（缩放 HP/DPS/召唤预算，不缩放移动能力）
- [ ] `dayContribution` 计算：有效伤害、承受伤害、召唤物存活时间、阻止幸存者推进配额的时间、感染点获取
- [ ] 感染点：每 10 伤害 1 点，10 点/分钟、40 点/Day 上限；同一目标短时间重复收益 100%/50%/25%，30 秒重置；护甲/盾/过量伤害/治疗后重复刷血不产生收益

### 12.2 待完成开发项 —— 每日全员答题（rev2 改，修复 rev1"只随机一人答题"问题，依赖 P3/P4）

- [ ] 每 Day 全体在线僵尸玩家各答一道自己的冻结题（题源/难度/accommodation 各自独立，题面/答案互不广播）
- [ ] 当日轮值者（按加入顺序轮转，不随机重复）执行三选一选卡
- [ ] 卡牌生效条件：答题者正确比例 ≥50%（向上取整）→ 全阵营共享生效；否则卡失效全阵营扣 10 感染点
- [ ] 每名答错者个人额外扣 5 感染点，不影响他人
- [ ] 仅 1 名僵尸玩家时退化为原规则（答对即生效）
- [ ] 僵尸个人小卡：每累计 30 感染点触发一次个人三选一，`personal_scope` 子集（约 30 张）抽取，只影响自己身体，占个人 3 槽（不占阵营 6 槽），同样需答题
- [ ] 玩家操控体获得全部僵尸共享卡 + 个人+5% + 职业修正

### 12.3 待完成开发项 —— 多人 Boss 共享预算（计划书 §4.3.3，rev2 新增空间预算与令牌）

- [ ] 数值预算：固定总 HP/总 DPS/总召唤预算按人数均分，`bossScale` 逐人应用后再求和；移动能力不拆分
- [ ] **空间预算**：任意两玩家 Boss 间强制最小间距 12 米，违反时 Host 把较晚进入的 Boss 权威推开（0.5 秒硬直）；安全复活点半径 8 米"Boss 禁入区"，Boss 进入后 2 秒内强制位移出去+5 秒该点禁入冷却；幸存者复活保护期 `3+1×(僵尸玩家数-1)` 秒，上限 6 秒
- [ ] **令牌规则**：Host 持有一个大招令牌+一个控制令牌，两者独立；`CLAIM_ULTIMATE`/`CLAIM_CONTROL` 按到达 tick 升序排序，同 tick 按 `player_id` 字典序升序判胜者唯一；胜者 3 秒施法权，失败者收到 `*_DENIED` 进入 2 秒本地再申请冷却（不消耗技能冷却）；大招令牌共享冷却 40 秒，控制令牌共享冷却 15 秒；令牌状态进入检查点与领域事件

### 12.4 待完成开发项 —— 转换与退出规则

- [ ] 僵尸玩家退出由 AI 接管身体或同一 Boss，180 秒内可重连认领
- [ ] 全部僵尸玩家永久离开后转为 PvE；转换前段落保留在非对称参与/学习记录，不产生非对称胜场，转换后 Day 不进入合作段位
- [ ] 幸存者主动退出不算僵尸击杀；幸存者全部主动退出为 `NO_CONTEST`

### 12.5 待完成开发项 —— 美术资产补齐

- [ ] 僵尸玩家 4 职业挂件（见 §10.4，与 P8 共享待办）
- [ ] 召唤出生口 + 污染区网格（资产清单 §5.3，P10 阶段仅需补这两项，Boss 复用 P5）

### 12.6 测试与验证

- [ ] 非对称每 Day 全员答题：50% 阈值向上取整、个人扣分不影响他人、单僵尸退化路径
- [ ] `bossScale` 故意送死→0.7、正常发挥→1.0
- [ ] 大招/控制令牌同 tick 争用确定性胜者
- [ ] 最小间距推开、复活点禁入
- [ ] 班级内非对称配对场次（依赖 P11 教师入口）跑通验证胜场累积

---

## 13. P11：教学后台集成（跨两个仓库：主站 `NingAcademy` + `NingAcademy-Games`）

**前置依赖**：P-1（✅）+ P0 生产部署（🔄 AI 接续中，仅剩 §2.2.0 的 4 项用户授权未拿到）。主站侧的作业创建/解锁部分已可独立于 Games 引擎进度推进。

### 13.1 已完成（主站仓库，据 `AGENTS.md` 与 migration 记录）

- [x] `assignments.assignment_kind`（`plain|game`）落地
- [x] `game_unlock_requirements` / `game_assignment_versions` / `game_assignment_completion_status` 统一解锁模型（20260815170000_game_unlock_scheme_b.sql）
- [x] 教师学期 `academic_terms`（按教师+班级排他约束）
- [x] `/teacher/assignments/new/game`：教师创建游戏作业入口，Scheme B 要求配置
- [x] 教师可替换当前活跃不可变要求版本（从作业详情页）
- [x] `assignment_kind` 分支已接入学生/教师作业列表与详情页
- [x] `due-items.ts`/`next-due-item.ts` 通过 `get_game_assignment_completion_v1` 折入待办/逾期计算
- [x] 学生可启动已发布游戏作业（launch ticket 流程，见 P0 §2.1）
- [x] 撤销传播触发器（登出/改密/停用/强改密/转教师/解锁版本替换）已接入 `revoke_game_sessions_v1`

### 13.2 待完成开发项（主站仓库）

- [ ] **教师游戏报告 UI**（`get_teacher_game_report_v1` RPC 已在权限白名单里，但前端页面未接线 —— 需要新建 `/teacher/game-reports` 或类似路由）
- [ ] **教师 accommodation 配置 UI**（视觉安全上限/计时策略，写入 `game_assignment_versions.frozen_config`，学生只能进一步降低——RPC `set_game_assignment_accommodation_v1` 已在白名单，前端未接）
- [ ] **班级内非对称配对场次入口**：教师在游戏中心创建练习场次，指定班级/时间窗/目标比例，系统在已报名学生中按 1v1/2v1/3v1 自动组队开房（依赖 P10 §12.6 的验证胜场统计逻辑先跑通）
- [ ] 教师临时关闭学生游戏权限的入口（若尚未有专门 UI，需要确认是否已经复用现有账号停用机制或需要新建）
- [ ] 学生个人段位/分项学习报告页面（依赖 P12 段位计算引擎完成后才有数据可展示）

### 13.3 待完成开发项（Games 仓库）

- [ ] 学生/教师"游戏中心"页面深化（当前 `apps/web/src/app/page.tsx` 为大厅占位，需要确认现有实现深度并补齐导航、房间列表、个人进度展示）
- [ ] 题源与临时关闭权限在 Games 侧的响应逻辑（收到主站撤销信号后的 UI 反馈）

### 13.4 测试与验证

- [ ] 教师报告数据只能看到自己有权限的学生/班级（越权测试）
- [ ] accommodation 设置立即在下一次题目下发时生效
- [ ] 班级内配对场次严格限定在单个教师单个班级内，不构成公共匹配（安全测试）

---

## 14. P12：治理与结算

**前置依赖**：P9/P10 玩法数据产出（段位计算需要真实对局数据）+ P0 生产部署。

### 14.1 已完成

- [x] 撤销触发器体系（主站仓库，见 §13.1）

### 14.2 待完成开发项 —— 个人段位

- [ ] 幸存者单人/合作段位：最近 70 道正式限时首答正确率（`causally_voided` 整条剔除不占位），至少 35 道结束"定位中"；青铜→白银(6,65%)→黄金(12,70%)→铂金(20,75%)→钻石(25,85%)→大师(30,90%)→吊炸天(50,95%)（equivalent Day + 正确率）
- [ ] 僵尸个人段位：验证胜场+正确率；白银 3/65%、黄金 5/70%、铂金 9/75%、钻石 14/85%、大师 20/90%、吊炸天 30/95%；仅 1v1/2v1/3v1 进入验证胜场统计
- [ ] 段位仅在对局永久结算时重算，检查点/5 小时休息/中途保存不重算
- [ ] 答错降低滚动正确率，可能在最终结算时降段

### 14.3 待完成开发项 —— 日志脱敏（字段白名单，当前 Games 代码未发现相关中间件）

- [ ] 结构化日志白名单机制（不是黑名单）：`ticket`/`token`/`cookie`/`set-cookie`/`authorization`/`answer`/`answer_hash`/`question_text`/`audio_url`/`sdp`/`candidate` 永不进日志（Main Vercel、Games Vercel、浏览器诊断、Postgres 分别配置）
- [ ] 序列化中间件在写出前按 key 替换为 `[redacted:len=N]`
- [ ] Postgres 侧 `log_statement='ddl'`（禁止 `all`），`log_min_duration_statement` 只记录耗时不记录参数
- [ ] CI 测试：对样本日志 grep `__Host-`/`ticket=`/`answer`/`Bearer ` 零命中

### 14.4 待完成开发项 —— 撤销 SLO 实测

- [ ] 测量 `revocation_latency_p95 ≤5s`、`p99 ≤15s`（生产环境或高保真预发环境实测，不能只是单元测试）
- [ ] 分别测试 API poll、heartbeat、Host 移除、会话已撤销后重新协商拒绝四条路径

### 14.5 待完成开发项 —— 数据保留、删除、申诉、导出

- [ ] 个人明细保留期计算：绑定教师学期"学期结束+30天"、`term_id` 为空或系统学期按"最后活动+180天"
- [ ] 票据 24 小时内清除任务
- [ ] 账号删除立即提前撤销与匿名化
- [ ] 高频片段申诉上传流程：学生/教师申诉、Host runtime 异常或管理员手动导出，每次最多事件前后 30 秒 ≤2MB
- [ ] 学生/教师申诉入口 UI（依赖 P11）
- [ ] 数据导出功能

### 14.6 待完成开发项 —— 赛季/规则冻结

- [ ] 发布 manifest 固定字段：`tutoring_commit/db_contract_version/protocol_version/simulation_version/ruleset_version/content_release_id/generator_version/asset_manifest_id`
- [ ] 版本支持窗口：Host runtime 只支持 current 与 N-1；活跃存档恢复窗口 7 天（个案可延至 14 天）；超窗口存档转为只读历史结果；协议不兼容显示"游戏正在更新"

### 14.7 测试与验证

- [ ] 无高可信竞技榜单确认（产品层面复核，不做全体玩家排行榜）
- [ ] 教师授权报告越权测试（同 §13.4）
- [ ] 申诉/导出流程端到端测试
- [ ] 删除/匿名化任务的幂等性与不可逆性验证

---

## 15. P13：内容完整化、集成测试与发布

**前置依赖**：P2–P12 全部完成。这是最后收尾阶段。

### 15.1 待完成开发项 —— 内容与资产收尾

- [ ] 进阶武器阶段 3（laser/plasma/staff，依赖 §9.3 的设计决策先做出）全部完成
- [ ] 全部消耗品/部署物最终接入引擎（美术已交付，见 §4.4）
- [ ] `LocalAuthority` 离线练习模式完整可玩（依赖全部引擎系统接线完成）

### 15.2 待完成开发项 —— 独立回滚演练

- [ ] Games web/API 与 `content_release` 独立回滚演练（数据库只前滚，不用 down 脚本）
- [ ] 一次完整的 forward-fix migration 演练
- [ ] `game.ningacademy.org` 正式切换流程演练

### 15.3 待完成开发项 —— 灰度发布

- [ ] 2–8 人/移动端/课堂灰度测试计划制定
- [ ] 教师小班灰度，收集反馈
- [ ] 灰度通过后才开放完整 V1（对照 §17 发布门槛）

### 15.4 测试与验证（收尾级，覆盖全部 §6 测试门槛，详见 §16–§20）

- [ ] 全部 §16–§20 条目逐一过一遍，无遗漏项后才进入发布

---

## 16. 跨阶段：安全检查清单（对照计划书 §6.2，随对应阶段推进逐条打勾，这里汇总避免遗漏）

- [ ] CSRF、Origin、Sec-Fetch、CORS、Cookie 属性（`__Host-` 前缀、无 Domain、Strict）、同源 Games API、限速/消息大小、房间码暴力尝试、重复请求、伪造 user ID、越权教师报告
- [ ] **房间码≠授权**：构造"持有正确房间码但不在 `assignment_targets`/邀请 ACL 内"的账号必须被拒绝（对应 §11.1 的 ACL 校验需要专项测试验证）
- [ ] **教室共享 IP**：模拟同 IP 40 个已认证账号并发登录与开局，全部成功、零封禁、只产生告警（限速表见计划书 §3.3.5，需要确认限速中间件是否已实现——当前代码未发现限速实现，⬜ 待开发）
- [ ] **撤销 SLO** 见 §14.4
- [ ] **Games session**：过期、撤销、伪造、重放 ticket 均拒绝；普通 Supabase JWT、Authorization header、query/localStorage token 均不能替代
- [ ] **日志脱敏** 见 §14.3
- [ ] **听力泄露** 见 §5.6
- [ ] 断言：`assignables.assignable_kind` 不接受 `game`（循环锁定不可能构造，主站仓库测试）
- [ ] 逐函数校验：`SECURITY INVOKER/DEFINER`、owner、`FORCE ROW LEVEL SECURITY`、`games_api` 零表权限、`game_private` 无 USAGE、旧运行时角色零执行权限、票据双兑换竞态、答案幂等、退出撤销、作业类型分派
- [ ] 断言：含 `DROP COLUMN`/`DROP FUNCTION` 的 migration 必须声明已下线的合同版本号

### 16.1 ⬜ 待开发 —— 限速中间件（当前未发现实现）

- [ ] 账号维度：登录 10/5分钟递增退避；签发票据 6/分钟；兑换票据 6/分钟；房间码尝试 10/10分钟锁定30分钟；信令发送 120/分钟（重复 SDP/ICE 幂等去重）
- [ ] peer 维度：高频 input 30/秒（Host 丢弃计数）；可靠命令 10/秒（Host 拒绝计数）；总量 64/秒硬上限（Host 关闭该 peer）
- [ ] IP 维度：未认证 300/分钟 429；已认证 1200/分钟只告警不封禁；识别"教育共享出口"（同 IP≥8 个不同已登录账号全部通过认证）自动提升到 3000/分钟只告警
- [ ] **永不基于 IP 封禁已认证账号**——写成显式测试，防止未来误改
- [ ] 教师后台申报教室出口 IP 段白名单入口（依赖 P11）
- [ ] RTC 应用消息最大 64KiB；信令 payload 最大 64KiB；snapshot 分包或 binary encoding

---

## 17. 跨阶段：测试与 QA 清单（对照计划书 §6.1/§6.3/§6.6–§6.10，未在前述阶段列出的补充项）

### 17.1 数据库（见 §1.2，持续性任务）

### 17.2 游戏核心（见 §6.5/§7.6/§9.4）

### 17.3 网络（见 §11.5）

### 17.4 合作与救援（见 §11.5）

### 17.5 内容（见 §6.5）

### 17.6 无血与可访问性

- [ ] 构建物不含血液/喷溅/肢解/肉块/持久尸体素材（人工美术审核 checklist）
- [ ] 四生态、所有武器、50 怪连爆、Boss 演出逐帧闪烁分析，滚动 1 秒 ≤2 次，并人工复核（依赖 `FlashGovernor` 已有实现，需补自动化逐帧分析工具）
- [ ] 减少动态效果后仍保留轮廓/字幕/图标/声音提示
- [ ] 听力静音期间仍有完整视觉信息（见 §5.4）

### 17.7 手机

- [ ] Chrome Android、Safari iOS 真机测试
- [ ] 触控、横屏安全区、软键盘、后台切换、发热、内存
- [ ] 180 秒重连全量通过
- [ ] 暂停 UI 与听力静音移动端单独验证（含来电/切后台打断音频的恢复）

### 17.8 性能（暂缓到有完整可玩场景后执行，但预算数字现在就要记住，避免后期返工）

- [ ] Iris Xe 720p 压力场景总帧 p95 ≤33.3ms，结晶效果增量 CPU ≤2ms/GPU ≤3ms
- [ ] GTX1650 1080p 总帧 p95 ≤16.7ms
- [ ] 30 分钟 VFX soak 后 heap 漂移 ≤5MB
- [ ] proc 预算：262 卡满载、24 常驻被动、50 怪同屏场景下卡牌系统每 tick CPU ≤3ms，超预算丢弃顺序确定且不产生表现闪烁
- [ ] 大厅 ≤15MB；选定生态可玩资源 ≤50–60MB；完整生态 ≤80MB；移动低档可玩资源 ≤45MB（依赖 P6 地图资产完成后才能真实测量）

---

## 18. 跨阶段：部署与环境配置清单（汇总，标注哪些是 🚫 用户授权、哪些是 AI 可执行，避免散落漏项）

- [x] 🚫 Production migration 最终审批（9 个 migration，见 §2.2.0-1）—— 已完成 2026-08-16
- [x] ⬜ Production migration 实际执行（见 §2.2.1）—— 已完成 2026-08-16，Production 28 个版本与 Git 前 28 条逐条匹配
- [ ] 🚫 **`rls_auto_enable()` EXECUTE 收权 migration 审批**（见 §2.2.0-1a）—— migration 已起草、P-1 clean replay CI 已通过（run #39，2026-08-17），**只差你批准执行到 Production**
- [ ] ⬜ `rls_auto_enable()` migration 实际执行（见 §2.2.1，AI 用 Supabase MCP 执行，依赖上一条批准）
- [ ] 🚫 **受限 DB LOGIN 创建与授权**（见 §2.2.0-2）—— 建议排在上一条之后做，保持权限链干净
- [ ] 🚫 **Games Vercel Production 项目创建**（见 §2.2.0-3）—— 与其余 🚫 项无依赖，可随时单独做
- [ ] ⬜ Games Vercel 环境变量配置（见 §2.2.1，AI 用 Vercel CLI/API 执行，依赖上一条项目创建）
- [ ] 🚫 **`game.ningacademy.org` / `assets.ningacademy.org` DNS 记录**（见 §2.2.0-4）—— 与其余 🚫 项无依赖，可随时单独做
- [ ] ⬜ R2 四 bucket 创建与 API token（见 §4.3，AI 用 Cloudflare API/`wrangler` 执行）
- [ ] ⬜ Cloudflare Worker 音频代理部署（见 §5.5，AI 用 `wrangler` 执行；生产自定义域路由依赖上面的 DNS 记录）
- [ ] ⬜ TURN 服务器：V1 默认不购买，仅预留接口（`GAME_TURN_*`），后续按需接入（不阻塞发布）
- [ ] ⚠️ Vercel Hobby → Pro 升级评估（若 NingAcademy 属于商业使用，生产发布前必须升级；AI 可评估并给出建议，实际下单付费需要用户用已有账号操作——这是产品/商务决策，不属于本文档 4 类 🚫 范围）
- [ ] ⬜ Supabase 与 Vercel 用量/备份/商业条款按正式使用量在上线门禁复核
- [ ] ⬜ R2 用量监控与配额告警设置（10GB-month 免费额度，默认关闭全量高频回放以保持在额度内）

---

## 19. 跨阶段：文档、备份、监控清单

- [ ] 每次完成一个 P 阶段后更新 `docs/project-status-rev2.1.md`
- [ ] 每次完成一个 P 阶段后回来勾掉本文档对应条目
- [ ] Production migration 执行记录归档（时间、执行人、结果、preflight 报告链接）
- [ ] R2 checkpoints/replays/anticheat 三个 bucket 的 lifecycle 到期删除策略文档化并验证生效
- [ ] 撤销 SLO、revocation_latency 等关键指标的监控仪表盘（P12 阶段建议接入，具体平台待定）
- [ ] 发布 manifest（`tutoring_commit/db_contract_version/protocol_version/...`）版本历史记录表
- [ ] 事故/回滚演练记录（P13 §15.2 的演练结果需要写成文档留档）

---

## 20. 发布门槛最终检查（对照计划书 §6.11，全部满足才能开放完整 V1）

- [ ] 连续 7 天无 P0 事故
- [ ] Games Vercel、Supabase 信令或 P2P 连接故障均不影响 NingAcademy 普通作业；单人 `LocalAuthority` 在无需保存结果时不依赖多人服务
- [ ] Games web/API 与 content 可独立回滚并完成演练；数据库只前滚，已演练一次 forward-fix 流程
- [ ] 教师小班灰度通过
- [ ] 本文档 §1–§19 全部条目已勾选或已明确记录为"有意跳过并说明理由"

---

## 附录：本文档与代码库的对应关系（便于后续复查更新本清单本身）

| 判断依据 | 对应文件 |
|---|---|
| 规则来源 | `NingAcademy-3DFPS-V1-实施计划-rev2.1-BossIndependent.md` |
| 建模资产规格 | `apps/web/public/game/models/NingAcademy-Game-建模资产清单-v1.1-BossIndependent.md` |
| 已知生产阻塞项 | `docs/project-status-rev2.1.md` |
| 产品不变量 | `docs/locked-product-rules.md` |
| 跨仓库合同 | `docs/main-site-integration.md` |
| 引擎实现现状 | `packages/game-core/src/*.ts`、`packages/protocol/src/*.ts`、`packages/authority/src/*.ts` |
| 内容 DSL 与数据 | `packages/content/src/schema.ts`、`catalog-source-*.ts`、`full-catalog.ts` |
| 已交付美术资产与 CI 校验 | `apps/web/public/game/models/**`、`scripts/verify-model-assets.mjs` |
| 主站游戏子系统现状 | 主站仓库 `AGENTS.md`「Game subsystem」章节、`docs/p1/**`、`supabase/migrations/202608151*` |

**更新本文档的方法**：每次代码有实质性进展后，重新跑一遍本文档开头"如何使用"里描述的核对流程（读计划书对应章节 + 读对应代码文件 + 核对 git log），而不是凭记忆勾选。
