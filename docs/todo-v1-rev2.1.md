# NingAcademy Game V1 完整待办清单（rev2.1 执行版）

> 生成时间：2026-08-16；最后一次实际代码核对与实施：2026-08-21（工作树基于 commit `c834808`，本轮改动尚未提交）。基于 `NingAcademy-3DFPS-V1-实施计划-rev2.1-BossIndependent.md`（下称"计划书"）逐条拆解，并对照 `NingAcademy-Games` 仓库当前代码、`docs/project-status-rev2.1.md`、`docs/locked-product-rules.md`、`docs/main-site-integration.md` 与主站 `NingAcademy` 仓库的 `docs/p1/`、`supabase/migrations/`、`AGENTS.md` 核对了实际完成度。
>
> **这不是一份新计划，是把计划书 §2–§6 转成可以逐条打勾执行的任务清单。** 规则本身以计划书为准；本文档若与计划书冲突，以计划书为准并回来改本文档。
>
> ## 2026-08-21 修改前基线复核记录
>
> 重新读取两个仓库全部代码 + 直接跑 `mcp__supabase__list_migrations`/`get_advisors` 对照本文档逐条核实后的变化：
>
> 1. **migration 审批链路已全部走完**：上一版记录为"待批准"的 `rls_auto_enable()` EXECUTE 收权 migration（原 1a）已于 2026-08-17 现场确认应用到 Production；2026-08-17 新发现并起草的 P2P 建房 503 故障修复 migration（Git 第 30 条，`20260818021000_fix_p2p_room_code_random_source.sql`，本文档记为 1b）**本次核实也已应用到 Production**——`list_migrations` 实测 Production 30/30，与 Git 30 个文件逐条（版本号+文件名）精确匹配。§2.2.0 需要用户操作的事项从 4 项收窄为 3 项（DB LOGIN / Vercel 项目 / DNS）。
> 2. `mcp__supabase__get_advisors`（security）复核：83 条告警全部是这个项目一贯的 SECURITY DEFINER 约定告警或 `game`/`game_private`/`private` 未暴露 schema 上的 `rls_enabled_no_policy`（INFO 级、按设计如此），**没有发现与近期 migration 相关的新告警**，`rls_auto_enable()` 的 PUBLIC EXECUTE 告警已不再出现。
> 3. **P2 的 Babylon 场景比原记录更靠前**：本轮修改前，`apps/web/src/components/practice-arena.tsx` 已经用真实 Babylon `Engine`/`Scene` 加载注册模型并跑渲染循环，但只接在单人 `LocalPracticeAuthority` 路径上；多人房间场景/预测/reconciliation/插值当时仍是零起点。当前状态见紧随其后的 gameplay 实施追加和 §4.2。
> 4. **P1 对抗性规则逐条复核**：瞬移拒绝、伪造击杀防御、权威状态覆盖拒绝均已实现且（除伪造击杀外）已有测试；超射速开火与无弹药开火的**校验代码本身已存在**，只缺对应单元测试。同时发现文档自相矛盾——`COMBAT_REWIND_WINDOW_MS` 代码实测是 **250ms**，不是文档一直沿用的 200ms，已统一订正。
> 5. **P11 Games 仓库"游戏中心"页面比原记录更靠前**：不是纯占位，已有真实的 WebRTC 建房/加房大厅（`multiplayer-lobby.tsx`），仍缺房间列表/进度展示/仪表盘。
> 6. §2.3 里两条原本标"需要核对是否已写"的主站测试（`academic_terms` 排他约束、`game_assignment_versions` 触发器保护）本次确认**均未写**，不再是"待核对"而是明确的待办。
> 7. P3/P4/P5/P6/P7/P8/P9/P10/P12/§16.1/P13 的其余条目逐一比对代码后确认与上一版记录一致，无新增内容——`NingAcademy-Games` 仓库自 2026-08-17 之后没有新提交（`git log` 确认），这些阶段的工程状态本来就不会变。
> 8. **无法从仓库内验证的三项**（DB LOGIN 创建、Vercel Production 项目创建、DNS 配置）本次一律按"未完成"处理——如果你已经在 Supabase/Vercel/DNS 控制台外操作过，请告知以更新本文档。
>
> ## 2026-08-21 gameplay 实施追加（未执行任何 Production 写入）
>
> 1. P1 对抗性 Gate 已补齐：新增伪造击杀、超射速与空弹开火回归测试；三者均断言 Host 拒绝且不改变权威伤害/弹药/世界状态。P1 的确定性 Host-vs-LocalAuthority、精确 rewind 边界和 soak 仍是独立待办，不能因此把整个 P1 测试阶段写成 100%。
> 2. 多人房间 `running` 状态已从纯大厅切换为真实 Babylon gameplay：本机第一人称步枪、远端第三人称幸存者与步枪、Thrall、WASD/鼠标/射击/换弹、Host 权威 HP/弹药/命中/死亡/重生、成员永久离开后的 despawn 均已接线。这里仍是“一枪一怪平面场”的 P1 内容，不代表完整 FPS 内容完成。
> 3. 新增 `MultiplayerPresentationTimeline`：本地只预测移动，收到新 Host snapshot 后丢弃已确认输入并重放剩余输入；远端幸存者与 Thrall 以 100ms 展示延迟插值；旧 revision/错房间快照被丢弃。伤害、HP、弹药、命中与重生从未下放给 peer。
> 4. Host 玩家也通过与 peer 相同的 `combat.input` 权威处理路径驱动自身；输入 yaw 与斜向移动先归一化到 game-core 的合法范围。`player.leave` 现在同步移除 `combat.survivors` 与 history 中的对应实体，而暂时断线、仍在 180 秒重连窗口内的成员不会被误删。
> 5. 本轮验证：`check:boundaries`、typecheck、lint、23 个 Vitest 文件共 106 项测试、Next 16.3 production build、模型检查和 8-context P2P Playwright 均已通过；本地浏览器 smoke 已确认主页/单人 Babylon 场景无框架错误覆盖层。真实 Production 多人房间没有在本轮创建，仍需受限 DB LOGIN/Vercel/DNS 后做认证 E2E。
> 6. 按完整可玩 FPS V1 的功能权重估算，当前整体完成度约 **27%**；这是对代码与测试覆盖面的工程估算，不是阶段勾选数的平均值。
>
> ## 2026-08-21 P6 greybox / Enemy Collection / Wave 实施追加（未执行任何 Production 写入）
>
> 1. 已在既有 Host-authoritative 架构内加入确定性 5×5 greybox：共享 seed、版本化 canonical/collision/asset id、FNV-1a `layoutHash`、紧凑 module placements、8 个 player spawn、4 个 enemy spawn zone、navigation bounds/graph、碰撞体，以及 Supply/Boss 预留区。WebRTC 只传元数据/世界状态，不传 mesh。
> 2. Host 模拟与 peer 本地预测共用同一地图边界/碰撞函数；snapshot/checkpoint 携带地图契约，hash/版本不匹配直接拒绝。该项是 P6 的确定性 gameplay 基础，不代表四生态正式模块资产、预烘焙 navmesh 或资源预算管线已经完成。
> 3. 单 Thrall 状态已升级为 stable `entityId` 敌人集合；生成、AI/target、移动、攻击、HP、死亡、墓碑 despawn 全部只由 Host 决定，peer 只按快照插值并播放 spawn/move/attack/hit/death。旧/迟到快照不能复活墓碑实体。
> 4. 新增最小 Wave Director：权威 wave number/kind/phase/revision、remaining、确定性 spawn seed/schedule/zone selection、wave start/complete 与 break timer；Wave 1 为 3 只，后续数量与 HP 递增。它为未来 Day/Supply/Boss 扩展留接口，但没有假装实现完整 Day 状态机。
> 5. snapshot 保留 room/revision/topology epoch 校验并新增 enemy/wave revision；checkpoint round-trip 已覆盖地图、敌人集合与 Wave 重建兼容性。真实 authenticated late join、reconnect、Host migration gameplay E2E 仍未完成。
> 6. 新增并通过多敌人稳定 ID、重复/墓碑生成拒绝、despawn 一致性、伪造击杀拒绝、Wave 开始/阻塞完成/下一 Wave、late snapshot 防复活、stale wave revision、Host+多 Peer 同视图等测试。最终验证为 typecheck、lint、25 个 Vitest 文件/122 项测试、Next 16.3 production build、boundary、70/65 模型检查、Host+7 Peers Playwright 与 Babylon 9.21/WebGL2 浏览器 smoke 全通过。
> 7. 按完整可玩 FPS V1 的功能权重重新估算，当前整体完成度约 **31%**；本轮未修改 NingAcademy 主站，也未执行 Production DDL/DML/migration/data write/deploy。
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
> 1. 按 §0 总览表确认当前所处阶段（当前重心：**P1 剩余确定性验证 + P2 移动端/网络压力验证 + P4/P5/P6/P7 实际玩法引擎**；P0 生产收尾等待 3 项用户操作，但不阻塞本地玩法开发）。
> 2. 每个阶段内部条目**大致**按依赖顺序排列，但同一层级标"可并行"的条目之间没有先后要求。
> 3. 阶段之间的强依赖见每节开头的"前置依赖"。**不要**在前置未完成时开始下一阶段的引擎开发（计划书 §2 明确写死 P-1 未过禁止设计任何游戏表；rev2 同理要求 P4 卡牌先于 P5 引擎接线，P6 地图 hash 先于 P9 联机验证）。
> 4. 每次完成一批任务后，回来把对应 `- [ ]` 改成 `- [x]`，并更新 §0 总览表与 `docs/project-status-rev2.1.md`。
> 5. **🚫 只保留 4 类事项**（见状态图例）。R2 bucket 创建、Cloudflare Worker 部署、Vercel/主站环境变量配置、Production migration 的**实际执行**（区别于"批准"）等，全部通过对应平台的 CLI/API/Supabase MCP 工具由 AI 完成，标 🔄/⬜。真正写入任何 Production DDL/DML 前，仍需确认对应的 🚫 审批/授权步骤已经完成——这是执行前提，不是把整个任务标成 🚫 的理由。

---

## 0. 全局状态总览（速览表）

| 阶段 | 内容 | 状态 | 主要缺口 |
|---|---|---|---|
| P-1 | 数据库审计（主站仓库） | ✅ 完成 | 未来任何新 Production 发布前需要**重新**跑只读 preflight（不是一次性的） |
| P0 | 独立仓库、身份链、P2P 信令基础设施 | 🔄 数据库层 30/30 migration 已部署（含 2026-08-17 新发现并修复的 P2P 建房故障），剩 3 项 🚫 用户操作 | **需要你本人操作的 3 件事**（见 §2.2.0）：①创建受限数据库 LOGIN ②创建 Games Vercel Production 项目 ③配置 DNS。migration 审批链路已全部走完（2026-08-21 用 `list_migrations` 确认 Production 30/30 与 Git 逐条匹配）。这 3 项就位后，§2.2.1–2.2.5（配置/部署/验证/parity audit）全部由 AI 接续，不需要你再手动操作 |
| P1 | 单人垂直切片（一图一枪一怪） | 🔄 对抗性 Gate 已通过，余下确定性/rewind 边界/soak | 瞬移、伪造击杀、权威状态覆盖、超射速和无弹药射击均有自动化拒绝测试；Host-vs-LocalAuthority 逐 tick、250ms rewind 精确边界和长时运行仍未补 |
| P2 | Babylon 场景/预测/可访问性/R2 资产管线 | 🔄 桌面多人 greybox 场景与预测链已接入，移动端/音频/R2 未做 | Babylon 多人 greybox、多敌人呈现、移动预测、Host reconciliation、远端插值已完成；手机触控、learning/world 音频总线、裂纹 shader、R2 四 bucket、`assets.ningacademy.org` 仍未做 |
| P3 | 题目系统与听力防泄漏 | 🔄 协议层完成，判题/音频管线未做 | 听力 HMAC key 轮换、Cloudflare Worker、答题保护、听力静音总线均未实现 |
| P4 | 卡牌 DSL 与内容 | 🔄 DSL + 260/262 张卡数据完成，运行时引擎未接线 | S161/S162 缺失；机制槽/堆叠/proc 预算完全未进入 game-core |
| P5 | Day/Boss/难度曲线 | 🔄 最小 Wave Director + 4 个独立 Boss 美术包完成 | Wave 已能确定性生成/清空/休整/递增，但完整 Day、Supply、Boss Controller、词缀、精英变体、watchdog 均未实现 |
| P6 | 地图模块 | 🔄 确定性 multiplayer greybox 基础完成 | canonical layout/hash、spawn/navigation/collision/预留区已接线；四生态正式模块资产、预烘焙 navmesh 管线和资源预算验证未做 |
| P7 | 武器族与命中验证 | 🔄 5 把起始武器美术完成，命中验证引擎仅有基础步枪 | 狙击/冲锋/长矛/剑的专属校验与延迟策略均未实现 |
| P8 | 职业 | 🔄 5 幸存者美术 + 解锁题规则数据完成，技能引擎未做 | 10 个技能、僵尸玩家 4 职业挂件、通用资产（倒地态/复活态/决策态）未做 |
| P9 | 2–8 人合作 | 🔄 信令、基础多人战斗、敌人集合与 Wave 同步已接线 | 2–8 人基础移动/射击/HP、多敌人/Wave 同步已有；完整 late join/reconnect/Host migration、救援、共享 Day、强制休息、暂停配额与真实 gameplay 网络压测未做 |
| P10 | 非对称对抗 | ⬜ 未开始 | 僵尸玩家身体/生命数/重生延迟/感染点/Boss 空间预算/令牌全部未实现 |
| P11 | 教学后台集成 | 🔄 主站教师配置 UI 已上线，报告/申诉 UI 未接线 | 教师游戏报告、accommodation UI、班级内非对称配对入口未做 |
| P12 | 治理与结算 | ⬜ 基本未开始（撤销触发器已在主站落地） | 段位计算、日志脱敏白名单、撤销 SLO 实测、申诉/导出/匿名化未做 |
| P13 | 完整内容与发布 | ⬜ 未开始（内容目录已提前完成大半） | 进阶武器 stage3、全部集成测试、灰度发布流程未做 |

**关键判断（写清楚是为了不要重复踩坑）：**

- 这个项目目前仍是"内容/资产 领先于 引擎"的状态：卡牌 DSL 数据、4 个 Boss 完整美术包、5 名幸存者模型、起始武器模型都已经做了很多；运行时现在到达“确定性 greybox + 多敌人 + 最小 Wave + 单一步枪”，仍远未覆盖完整 Day/Boss/卡牌/库存。**下一步工程重心应该继续把已有内容接进引擎，而不是继续堆更多内容或美术。**
- P6 已不再是零代码：确定性 canonical greybox、layout hash、碰撞/导航/出生契约已经解除基础联机世界一致性的阻塞；但正式四生态模块资产与构建验证仍是计划书所说的“大块工作”，不能把本轮 greybox 误记为整个 P6 完成。
- P0 生产部署链路里真正需要用户本人操作的现在只剩 3 件事（创建并授权 DB LOGIN、创建 Vercel 项目、配置 DNS）——migration 审批已经全部走完：截至 2026-08-21，Production 30/30 migration 与 Git 逐条匹配，含 2026-08-17 新发现并修复的 P2P 建房故障（详见 §2.2.0）。其余全部——环境变量配置、实际部署、冒烟测试、DB parity audit、问题修复——都是 AI 可以直接执行的任务，完整流程见 §2.2。这 3 项授权到位后，后续阶段的"发布"环节复用同一套基础设施，不需要重复搭建。
- 2026-08-21 gameplay 实施后，P2 的桌面多人基础链路已从零推进到可运行：`multiplayer-arena.tsx` 消费 Host snapshot，`MultiplayerPresentationTimeline` 承担本地移动预测/确认输入重放/远端插值，房间 `running` 状态会进入 Babylon 场景。手机触控、真实延迟/丢包收敛 E2E、音频总线与 R2 仍未完成，详见 §4.2/§4.5。
- 2026-08-21 P6/Wave 实施后，最值得紧接着做的是**完整 late join/reconnect/Host migration gameplay restoration + 延迟/丢包/旧快照网络 E2E**：地图、enemy tombstones 和 wave revisions 已经进入快照/checkpoint，正是把重建闭环做实的合适时点；完成后再接 Loot/Inventory/Card runtime，能避免新系统继续扩大恢复缺口。

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

> 整条链路只有 **2.2.0** 里的几件事必须由用户本人操作或明确批准：migration 相关的三项（原始 1、rls_auto_enable 收权的 1a、P2P 建房修复的 1b）截至 2026-08-21 已全部确认应用到 Production，**剩 3 件（2/3/4）待你操作**，见下表。这些就位后，2.2.1–2.2.5（配置→部署→验证→DB parity audit→问题修复）全部由 AI 通过 Supabase MCP 工具（`apply_migration`/`list_migrations`/`execute_sql`/`get_advisors`）、Vercel CLI/API、Cloudflare CLI/API、脚本与测试工具接续执行，不需要用户逐步手动操作。**不要在已批准的清单之外主动扩大 Production 写入范围。**

#### 2.2.0 🚫 用户侧授权（migration 相关的 1/1a/1b 三项已全部完成；剩 2/3/4 共 3 项待你操作）

> **需要你本人操作/批准的还有 3 件事：2、3、4。** 除此之外的一切（migration 执行、验证、Vercel/Cloudflare 配置、部署、冒烟测试、parity audit）都是 AI 可以直接做的，不需要等你逐步操作。

1. [x] 🚫 **批准 Production migration**（已完成，2026-08-16）：`20260815160000` ~ `20260815200000` 这 9 个 migration（含 5 个游戏相关）已按文件名顺序应用到 Production——`mcp__supabase__list_migrations` 实测 Production 共 28 个 migration，与 Git 当前 29 条历史中的**前 28 条**逐条匹配；Git 第 29 条（`20260816150000_restrict_rls_auto_enable_execute.sql`，见 1a）是另一个 pending migration，不在这次核对范围内。**注意**：其中 `20260815180000_game_session_identity_v2.sql`、`20260815200000_game_p2p_signaling.sql` 两个文件在最初编写后又经历过 Postgres 17 临时角色成员关系清理的 bug 修复（commit `86a20a4`/`48471fa`/`a0bf694`），实际执行到 Production 上的是哪个版本尚未做逐字节确认，建议在 §2.2.4 parity audit 里一并核对。
   - 验证项：`docs/p1/MIGRATION_DRIFT_REPORT.md`"2026-08-16 Production deployment confirmed"一节记录了这次 spot-check 的范围与限制；**正式的受保护只读 schema/ACL/FK 全量重导出仍未在部署后重跑过**，不能当作已完成的完整 parity audit

1a. [x] 🚫 **批准 `rls_auto_enable()` EXECUTE 收权 migration**（已完成）：Security Advisor 复查发现 `public.rls_auto_enable()`（Supabase Dashboard 自动创建的 RLS 自动启用 event trigger 函数）仍带 PostgreSQL 默认的 PUBLIC EXECUTE，`anon`/`authenticated`/`service_role`/`game_server`/`games_api` 都能直接调用。
    - `supabase/migrations/20260816150000_restrict_rls_auto_enable_execute.sql`：只 `revoke execute`，不动函数体/owner/`SECURITY DEFINER`/event trigger；改为 `pg_catalog.to_regprocedure()` 判空后再 `execute` 的条件 no-op 写法，不存在该函数的环境（clean replay/CI/本地）安全跳过
    - **已应用到 Production**：2026-08-17 现场 spot-check 确认 `public.rls_auto_enable()` 对 `public`/`anon`/`authenticated` 均已无 EXECUTE 授权；2026-08-21 重新跑 `mcp__supabase__get_advisors`（security）复核，未再出现该函数的 PUBLIC EXECUTE 告警
    - P-1 CI 的批准-drift 过滤器最初漏算了这次收权在 `pg_dump` 里新产生的 `Type: ACL` 块——第一次真正的 protected-audit CI 运行（run `32098254600`，2026-08-17）复现了这个预判中的 gap，随后在 commit `9cbdd13` 补上第二条哈希锁定的过滤条目（`IA-2-ACL`），本地重放确认该 diff 已清零；**这个补丁本身还没有被真正的 CI 重跑验证过**，见 §2.2.4 遗留项

1b. [x] 🚫 **批准修复 P2P 建房故障的 migration 30**（已完成）：2026-08-17 发现学生"创建游戏房间"从 `POST /api/p2p/rooms` 收到 503——根因是 `game_private.new_p2p_room_code()` 在 `set search_path = ''` 下直接调用 `gen_random_bytes(6)`，该函数只存在于 `extensions` schema，而函数 owner `game_api_owner` 对 `extensions` 无 `USAGE`，导致该函数在 Production 从未成功解析过。
    - `supabase/migrations/20260818021000_fix_p2p_room_code_random_source.sql` 把随机源换成核心 Postgres 的 `pg_catalog.gen_random_uuid()`/`uuid_send()`（同一 `SET ROLE game_api_owner` 自限定授权模式），不改其他任何对象
    - **已应用到 Production**：2026-08-21 用 `mcp__supabase__list_migrations` 直接核对，Production 已有全部 30 个版本，与 Git 30 个文件逐条（版本号+文件名）精确匹配——**这是本次复核发现的最大变化**：上一版文档记录这一项"尚未应用"，现已确认完成
    - 遗留清理项（AI 可执行）：`scripts/p1/approved-pending-migrations.mjs` 此前把 migration 30 列为 P-1 CI 唯一可豁免的 pending migration；既然它已经上线，这份清单现在应该改回空，让 Git-vs-Production 历史比对恢复"必须完全一致"的严格模式，见 §2.2.5

2. [ ] 🚫 **创建并授权受限数据库 LOGIN**：在 Supabase 控制台创建一个可登录、无 owner/service-role 权限的 server-only credential，并执行 `GRANT games_api TO <login>`（不得复用任何现有 owner/service_role 凭据；`games_api` role 已存在，migration 链路已全部走完，权限链干净，随时可以创建）——**2026-08-21 复核：仓库内找不到任何已完成的证据，按未完成处理；如果你已经在 Supabase 控制台外操作过，请告知以更新本文档**
3. [ ] 🚫 **创建 Games Vercel Production 项目**：创建独立 Vercel Project 并绑定到 `NingAcademy-Games` GitHub 仓库（不可与主站共用同一个 Vercel Project，可以同一个 Vercel Team）——与步骤 2、4 **无依赖，可并行**；2026-08-21 复核：仓库内无 `.vercel`/`vercel.json` 等已创建证据，按未完成处理
4. [ ] 🚫 **配置正式域名 DNS**：添加 `game.ningacademy.org`（本节）与 `assets.ningacademy.org`（见 §4.3）两条 DNS 记录——与步骤 2、3 **无依赖，可并行**；DNS 状态无法从仓库内验证，按未完成处理

> migration 相关的 1/1a/1b 三项已全部完成。剩余的 2/3/4 之间没有硬顺序，能同时找用户一次性批完就一次性批完，不必逐条等待。

#### 2.2.1 ⬜ AI 自动继续：配置（各条依赖对应的 2.2.0 授权项，授权一到位就能立刻做）

- [x] 用 Supabase MCP `apply_migration`（或主站仓库 CLI）执行已批准的 9 个 migration —— 依赖 2.2.0-1，**只执行该步骤批准的清单**（2026-08-16 完成，Production 28 个版本与 Git 前 28 条逐条匹配；不含 Git 第 29/30 条 pending migration）
- [x] 用 Supabase MCP `apply_migration` 执行已批准的 `rls_auto_enable()` EXECUTE 收权 migration —— 依赖 2.2.0-1a（2026-08-17 现场 spot-check 确认四个角色均无 EXECUTE；2026-08-21 `get_advisors` 复核未见该函数的 PUBLIC EXECUTE 告警残留）
- [x] 用 Supabase MCP `apply_migration` 执行已批准的 migration 30（P2P 建房随机源修复）—— 依赖 2.2.0-1b（2026-08-21 用 `list_migrations` 确认 Production 已有全部 30 个版本，与 Git 逐条匹配）
- [ ] ⬜ 用 Supabase MCP `execute_sql` 验证 2.2.0-2 创建的 LOGIN 无表级权限、`SET ROLE games_api` 后只能 `EXECUTE` 白名单 RPC —— 依赖 2.2.0-2
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

- [x] 用 Supabase MCP `list_migrations` 核对 Production 已登记版本与 Git migration 清单一致（2026-08-21：30/30 精确匹配，见 §2.2.0-1b）
- [ ] ⬜ 逐字节核对 `20260815180000_game_session_identity_v2.sql`、`20260815200000_game_p2p_signaling.sql` 两个文件——它们在最初部署前又经历过角色清理 bug 修复（见 §2.2.0-1 备注）——确认 Production 上实际生效的函数体/角色语句与当前 Git 版本一致，不是某次中间态
- [ ] ⬜ 用 Supabase MCP `execute_sql` 重新导出 schema 关键对象（表/函数签名/RLS 策略/grant），与 P-1 报告基线 diff——注意：GitHub Actions 的 protected audit（run `32098254600`，2026-08-17）已经做过一次这个级别的 diff，当时只剩一处已批准的 ACL drift（见 §2.2.0-1a），但那次运行发生在 migration 30 上线**之前**；需要针对当前 30/30 状态重新跑一次正式的 protected audit 才能作数（同一条待办）
- [x] 用 Supabase MCP `get_advisors` 检查新出现的安全/性能告警（2026-08-21：83 条，57 条 `authenticated_security_definer_function_executable` + 26 条 `rls_enabled_no_policy`，全部落在这个项目一贯的 SECURITY DEFINER 约定与 `game`/`game_private`/`private` 未暴露 schema 上，均为 INFO 级、按设计如此；另有 1 条与本次改动无关的标准 `auth_leaked_password_protection` 建议；**没有发现任何与近期 migration 相关的新增告警**）
- [ ] ⬜ 产出更新版 parity 报告，追加到 `docs/p1/` 或新的部署审计记录——`docs/p1/MIGRATION_DRIFT_REPORT.md` 已经承担了这个角色并持续更新，但仍缺一次针对 30/30 状态的正式 protected-audit CI 运行结果
- 依赖：2.2.1 完成，可与 2.2.2/2.2.3 **并行**

#### 2.2.5 ⬜ AI 修复发现的问题

- [ ] ⬜ 冒烟测试（2.2.3）或 parity audit（2.2.4）发现的代码/配置问题直接修复并重新验证
- [ ] ⬜ 若问题需要新的 Production DDL/DML（例如需要一条 forward-fix migration），AI 写出 migration 草稿，但**执行前必须回到 2.2.0-1 式的人工批准**——不得绕开审批直接对 Production 写入
- [ ] ⬜ Production 部署/审计修复记录追加到 `docs/project-status-rev2.1.md`（该文件已于 2026-08-21 更新当前 gameplay、验证结果和 Production 依赖；但本条所指的下一次 Production 部署/parity 修复记录尚未发生，因此保持未勾选）
- [ ] ⬜ **新增**：把 `scripts/p1/approved-pending-migrations.mjs` 里 migration 30 的豁免条目清空，恢复 P-1 CI 的 Git-vs-Production 历史比对"必须逐条完全一致"的严格模式（见 §2.2.0-1b 遗留清理项）
- [ ] ⬜ **新增**：针对当前 30/30 状态重新跑一次正式的 protected-audit CI（`p1-database-audit.yml` 的 `workflow_dispatch` production-read-only 分支），确认 IA-2-ACL 补丁在真实 CI 里也能清零 ACL diff
- 依赖：2.2.3、2.2.4

#### 2.2.6 发布门槛达成

- [ ] ⬜ 2.2.1–2.2.5 全部通过后，把本节状态从"🔄"更新为"✅"，并同步更新 §0 总览表 P0 行状态

### 2.3 P0 测试与验证（代码层面，✅ 大部分已覆盖）

- [x] `npm run check:boundaries`：禁止浏览器代码引用 service-role/Claude 凭据、禁止 game-core 引用框架或浏览器全局、禁止追踪 `.env` 文件
- [x] `npm run test:p2p-e2e`：8 个 Playwright browser context 覆盖 Host→7 peers
- [ ] P2P fixtures 覆盖计划书 §6.1 要求的全部场景：create/join、无效/过期/满房、重复 peer、2–8 容量、membership、信令 TTL/cleanup、Host election、checkpoint 单调性、旧 topology signal 清除 —— **需要确认现有测试是否已覆盖全部子项，逐条补齐缺失用例**
- [ ] 断言：`academic_terms` 排他约束允许同教师跨班级重叠、禁止同教师同班级重叠（主站仓库测试）—— **2026-08-21 核实：主站仓库 `**/*.test.ts` 与 `supabase/tests/` 下均无 `academic_terms` 相关测试，确认未写，不再是"待核对"**
- [ ] 断言：`game_assignment_versions` 的 `UPDATE`/`DELETE` 被触发器阻止（主站仓库测试）—— **2026-08-21 核实：`supabase/tests/game_unlock_scheme_b.sql` 只测试了版本创建/切换流程，没有一条显式尝试直接 `UPDATE`/`DELETE` 该表并断言被拒绝的用例，确认未写，不再是"待核对"**

---

## 3. P1：单人核心垂直切片

**前置依赖**：P0 代码层面完成（✅），不要求生产部署完成即可继续开发。
**当前代码**：`packages/game-core/src/combat.ts`（895 行）+ `combat-types.ts` 已实现：平地图占位、单把 hitscan 步枪（`RifleState`：弹药/弹匣/下次开火 tick/换弹完成 tick）、单个 Thrall、Host 30Hz 权威 tick、250ms 命中历史缓冲、**250ms** rewind 窗口常量（`COMBAT_REWIND_WINDOW_MS`，`combat-types.ts:5`——本节此前一直误写成"200ms"，2026-08-21 复核代码后订正）。

### 3.1 对抗性开发项 —— 2026-08-21 已逐条关闭（`combat.ts` 895 行 / `combat-types.ts` 181 行 / `combat.test.ts` 466 行）

- [x] **peer 发送瞬移指令 → 已实现且已测试**：`combat.input` 协议本来就没有 position 字段（只有移动/瞄准意图，`combat-types.ts:85-94`），多出的 `position` 字段会被精确字段检查拒绝为 `INVALID_COMBAT_COMMAND`（`combat.ts:76-91`，测试见 `combat.test.ts:112-125`）；`isValidMovementTransition()`（`combat.ts:857-878`）另外对存档/恢复场景做位移裁剪（测试 `combat.test.ts:135,160`）
- [x] **peer 发送伪造击杀事件 → 结构性满足且已有回归测试**：`combat.fire` 载荷只有 `shotSequence`/`clientShotTimeMs`，`hit` 永远由 Host 的历史采样与射线计算；测试还把伪造的 `combat.entity_killed` 载荷直接送入 reducer，断言 `INVALID_COMBAT_COMMAND` 且 combat 引用完全不变
- [x] **peer 超射速开火（绕过 `nextFireTick`）→ 已测试**：射速间隔内第二枪返回 `WEAPON_UNAVAILABLE`，不消耗弹药、不改变 Thrall HP、不发事件
- [x] **无弹药情况下开火请求 → 已测试**：空弹状态开火返回 `WEAPON_UNAVAILABLE`，权威 state 引用不变、弹药保持 0、Thrall HP 不变
- [x] **peer 尝试直接提交/覆盖权威 world state → 已实现且已测试**：`HostP2PAuthorityRuntime.processCommand` 的执行者身份完全来自信令通道本身，从不读取载荷字段，伪造 membership 会直接抛错（`packages/authority/src/host-p2p-authority.ts:65-71`，测试 `host-p2p-authority.test.ts:18-23`）；`RemoteAuthority` 发送端也没有任何客户端可控的身份字段（`authority.test.ts:73-107`）；`CombatCommand` 联合类型里本来就没有"设置状态"这种变体
- [x] `CombatRuleErrorCode` 现状核实：`COMBAT_NOT_STARTED` / `COMBAT_PLAYER_INACTIVE` / `INPUT_EXPIRED` / `INPUT_SEQUENCE_REPLAY` / `INVALID_COMBAT_COMMAND` / `INVALID_MOVEMENT` / `WEAPON_UNAVAILABLE`（`combat-types.ts:151-158`）——与文档原记录一致，没有新增，本轮复核未发现遗漏路径需要新错误码

### 3.2 测试与验证（可与 3.1 并行编写）

- [ ] 单元测试：固定种子下 Host 与 `LocalAuthority` 的模拟结果逐 tick 完全一致（确定性回归测试）—— **2026-08-21 核实仍缺**：现有的只有 game-core 内部同种子双跑对比（`combat.test.ts:347-363`）和 checkpoint 相等性测试（`host-p2p-authority.test.ts:35-41`），没有一条真正把 Host 与 `LocalAuthority` 并排跑并逐 tick diff 的测试
- [ ] 单元测试：**rewind 窗口边界值**（249ms 接受 / 251ms 拒绝或按窗口裁剪——常量实测是 250ms，见本节开头订正）；现有只有一条笼统的"拒绝过老的一枪"测试（`combat.test.ts:237-259`），没有精确到边界值的用例
- [ ] 压力测试：单房间连续运行验证无 tick 漂移 / 无内存泄漏（为后续 30 分钟 VFX soak 测试打基础，见 §17.8）

### 3.3 验收 Gate（对照计划书 P1 行）

- [x] "peer 只能 input/intent，拒绝权威状态覆盖、瞬移、伪造击杀、超射速和无弹药射击" —— 五类对抗路径均已有自动化测试并通过。注意这只关闭 P1 的这一个 Gate，不会把 §3.2 的确定性、rewind 边界或 soak 自动标成完成。

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

- [x] **Babylon.js 基础场景搭建（单人 + 多人 greybox 内容）**：单人继续由 `practice-arena.tsx` 渲染；多人 `running` 房间由 `multiplayer-game.tsx`/`multiplayer-arena.tsx` 消费 Host snapshot，渲染本机 FP、远端 TP、deterministic greybox tiles/bounds/cover、多个 Thrall、权威 HP/弹药/死亡/重生与 enemy spawn/despawn。仍不包含正式地图资产、Boss、loot 或完整 Day。
- [x] 客户端移动预测（client-side prediction）：`MultiplayerPresentationTimeline.queueLocalInput()` 使用与 Host 相同的纯移动 integrator 立即推进本机位置；不会预测伤害、HP、弹药、命中或重生
- [x] Reconciliation：新 Host snapshot 到达后按 `authoritative.input.sequence` 丢弃已确认输入，并从权威 survivor 状态重放仍待确认的输入；旧 revision 和错房间快照直接丢弃
- [x] 远端实体插值（remote interpolation）：远端幸存者与 stable-id enemy collection 在约 100ms 展示延迟上对相邻 Host snapshot 做位置插值；权威 membership/enemy collection 是 render spawn/despawn 的唯一来源
- [ ] 手机触控输入：横屏双摇杆、按钮、安全区适配、轻度瞄准减速、小范围可见目标磁吸（明确**不做**自动开火、穿墙锁定）—— 2026-08-21 复核：没有任何摇杆组件，只有一处与触控无关的 CSS safe-area 用法（`apps/web/src/app/globals.css:34`，页面内边距）
- [ ] 结晶裂纹/碎裂表现接入 shader（美术已给出裂纹遮罩通道规范，见资产清单 §0.4）
- [ ] **音频总线拆分为 `learning` / `world` 两条**（为 P3 §4.5.3 听力静音做准备）—— 2026-08-21 复核仍未找到任何音频总线/mixer 实现

### 4.3 R2 资产管线（AI 可通过 Cloudflare API/`wrangler` CLI 执行，仅域名绑定需要 §2.2.0-4 的 DNS 授权；2026-08-21 复核：仓库内无 `wrangler.toml`、无任何 R2/Worker 相关脚本，确认这整节仍是零起点）

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

- [x] 预测/reconciliation 核心单元测试：旧/错房 snapshot 丢弃、远端玩家/多敌人插值、本地立即预测、Host 确认输入后回到权威位置、membership/enemy despawn 清理、tombstone 防复活、stale wave revision 拒绝、Host+多 Peer 同 world view（`multiplayer-presentation.test.ts`）
- [ ] 网络条件收敛测试：模拟 0/75/150/200ms RTT、jitter、2% 丢包和旧 snapshot 积压，断言客户端最终与 Host 收敛；当前核心时间线测试不能代替这条网络 E2E
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

- [ ] Games API 幂等判题：同一 `question_instance_id` + `request_id` 重复提交返回同一结果，不重复计分（`AnswerGradedMessage.duplicate` 字段已确认存在，`packages/protocol/src/learning.ts:69`；**2026-08-21 复核发现范围比原记录更大**：`SubmitAnswerMessage`/`AnswerGradedMessage` 目前只在 `packages/protocol` 内部和测试/文档里出现，`apps/web` 没有任何路由/server 代码引用它们——判题接口本身还没有任何后端实现，不只是缺持久化）
- [ ] 四类题型的实际出题来源接入：英译中 / 中译英 / 英语听力拼写 / 数学（计算、填空、判断）
- [ ] 错题复习调度：同一 Day 不重复，至少间隔 5 题，按 1/3/7 天复习节奏（不改写首答）
- [ ] accommodation（1×/1.5×/2×/无时限）在题目下发时的时限计算与应用；"无时限"在实时救援中按 2× 处理，其他题目真正无时限
- [ ] 题目隐私：同房不同玩家的题面/答案/Tier/策略互不广播（协议已设计为单播 `QuestionPresentedMessage`，需要在房间广播逻辑里确认真正做到不广播给其他 peer）

### 5.3 待完成开发项 —— §4.5.1 答题保护（当前 game-core 无 Day/Boss 概念，需与 P5 联合开发；2026-08-21 复核：`combat.ts` 目前只有固定的 `rifleDamage: 50`/`thrallAttackDamage: 8` 等常量，没有任何答题窗口相关的伤害倍率逻辑，本节仍是从零开始）

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

### 5.5 待完成 —— 听力音频管线（消除答案泄露信道，§4.8.2；AI 可通过代码+Cloudflare CLI 执行，仅生产自定义域路由依赖 §4.3 的 DNS 授权；2026-08-21 复核：仓库内未发现任何 `HMAC`/`content_release_salt`/Worker 代码，确认这整节仍是零起点）

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

> 2026-08-21 复核：`packages/content/src` 逐文件核对，与上一版记录完全一致——`catalog-source-s121-s160.ts` 仍止于 S160，仓库内没有任何 S161/S162 文件；四个 `catalog-source-s0*.ts` + 两个 `catalog-source-z0*.ts` 精确合计 260 张（160 幸存者 + 100 僵尸），不是 262。game-core 本轮新增 map/wave 文件，但仍没有 card runtime；对 "mechanism slot"/"proc_budget"/"card_state" 的检索仍是零匹配。

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

> 2026-08-21 最新实现：game-core 已有独立于完整 Day 的最小 `WaveDirectorState`，可确定性安排普通 Thrall、多实体清空后进入 break、再递增下一 Wave；这是未来 `QUOTA_COMBAT` 的可扩展底座。`Day`/`DAY_START`/`ZOMBIE_CARD`/`BOSS_TRANSITION`/`BossController`/`AIController` 仍未实现，不能把最小 Wave 当作 §7.2 Day 状态机完成。`scripts/verify-model-assets.mjs` 的跨 Boss URI 两两不相交断言也仍待加强。

### 7.1 已完成 —— Boss 美术资产（独立性已通过 CI 校验）

- [x] 4 个 Boss（猎袭者 Hunter / 巢群者 Swarm / 疫化者 Plague / 铁壳者 IronShell）各自独立 GLB + Skeleton + 动画 + 材质 + manifest + QA report，**零共享母体**
- [x] `scripts/verify-model-assets.mjs` 已经在 CI 里校验：
  - [x] 每个 Boss manifest 显式声明 `biome_bound=false`
  - [x] 每个 Boss manifest 声明 `controllers` 数组同时包含 `AIController` 与 `PlayerController`
  - [x] 每个 GLB 内部节点/动画/材质命名唯一，外部 URI 不逃逸出 `models` 根目录
  - [x] 警告（非阻塞）：可破坏部件少于 3 个时报警
- [ ] **待加强**：当前校验是"每个 Boss 自查"，没有做真正的"跨 Boss 资产依赖图断言"（即没有直接证明 Boss A 的贴图/骨骼文件没有被 Boss B 引用）。建议在 `verify-model-assets.mjs` 里加一条：收集四个 Boss 各自引用的外部 URI 集合，断言两两不相交

### 7.2 待完成开发项 —— Day 状态机（game-core 目前完全没有 Day 概念）

- [x] 最小权威 Wave 底座：wave number/kind/phase/revision、remaining、确定性 spawn seed/schedule/zone selection、start/complete、break timer、下一 Wave 数量/HP 递增；明确不含完整 Day/Supply/Boss 语义
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

## 8. P6：地图模块（🔄 deterministic greybox 基础完成）

**前置依赖**：无强依赖，**可以立即开始**，且不依赖 P4/P5 引擎进度。**强烈建议尽早排期**，因为 P9/P10 的联机压测、P5 的 Boss 场空间验证都需要真实地图才能测试，目前这些测试项事实上被 P6 阻塞。

> 2026-08-21 最新实现：`packages/game-core/src/map-layout.ts` 与多人 Babylon 场景已接入固定 canonical 5×5 greybox、`layoutHash`、模块 placements、player/enemy spawn、navigation graph/bounds、碰撞体和 Supply/Boss 预留区。它解决 Host/Peer/late snapshot 的确定性世界骨架；`apps/web/public/game/` 仍没有四生态正式 map GLB/tile 资产，Blender→navmesh/collision 预烘焙与资源预算管线仍是待办。

### 8.1 ⚠️ 待设计 —— 先定规范（计划书原文强调"规范没定就开工，P6 会全部返工"）

- [ ] 确定网格规范：单格 8m × 8m，墙高 4m，门洞宽 2.4m × 高 2.8m，连接口居中、同一尺寸同一高度同一朝向
- [ ] 确定 trim sheet 贴图规范：每生态 2×2048 共享贴图
- [ ] 确定碰撞体与 navmesh 的预烘焙工具链（Blender 导出规范，需要和现有 `build_boss_assets.py` / `build_weapon_assets.py` 的资产管线保持一致）
- [x] 确定 greybox `layout_hash` 算法与校验时机：规范化 metadata JSON → FNV-1a 32；snapshot decode、peer presentation 与 checkpoint restore 均拒绝 hash/版本不匹配

### 8.2 待制作 —— 每生态至少 4 类模块（房间/走廊/开阔地/Boss 场），实际约 12–16 个模块/生态

- [ ] **房屋**（简单，同屏 20 敌）：走廊（直/L/T/十字）、房间（卧室/客厅/厨房/储藏间）、楼梯间、**可动的门**（封门环境事件需要）、Boss 场（大厅/中庭）、**可熄灭的灯具**（停电事件需要）、警报器
- [ ] **草地**（普通，同屏 30 敌）：开放地形块、树林块（5–6 种树）、可破坏围栏段、小型建筑（谷仓/棚屋/水塔）、Boss 场（开阔平地+环形遮挡）、可燃草地贴片（草地火线事件）
- [ ] **沙漠**（困难，同屏 40 敌）：沙丘块（注意可攀爬性）、遗迹块（断柱/残墙/拱门）、峡谷段、低掩体、Boss 场（遗迹广场）、流沙区地面下陷网格
- [ ] **地狱**（地狱难度，同屏 50 敌，**面数需压到其他生态 70%**）：熔岩裂隙发光地面、祭坛（Boss 场核心）、窄桥梁、洞穴段、喷发口网格
- [ ] 四生态通用功能物件（每个都要做，四生态各一套外观）：玩家出生区标识、僵尸 spawn zone 标识（仅僵尸阵营可见）、安全复活点（含 8 米禁入范围可视化）、补给点（未开/开启中/已空三态）、目标点（进度环挂点）、危险区边界

### 8.3 待完成开发项 —— 生成器与校验

- [x] 最小 canonical greybox 布局生成器：只决定 5×5 整数网格的 module id/placement/0–270° rotation；Babylon 从本地 primitives 重建，不联网传 geometry（正式四生态组合生成器仍待 §8.2 资产）
- [x] Host 保存并下发的地图元数据结构：`seed / generator_version / canonical_layout_id / collision_layout_id / layout_hash / asset_manifest_id / module_placements[]`
- [x] peer 端 `layout_hash` 本地计算与比对，不一致时拒绝进入并提示"资源版本不匹配，请刷新"（**不允许降级进入**）
- [ ] `generator_version` 递增机制，旧存档在支持窗口内继续用旧版本模块包（对照 §3.7.4 current/N-1 约束）
- [x] game-core greybox 自动验证：navigation graph 连通、节点/玩家出生/敌人 zone 可达、碰撞边界与 layout hash；纳入 Vitest
- [ ] 正式地图发布验证：预烘焙 navmesh、Boss 场/安全复活点语义与资源预算（大厅 ≤15MB、选定生态 ≤50–60MB、完整生态 ≤80MB、手机低档 ≤45MB）

### 8.4 测试与验证

- [x] `layout_hash` 不匹配必须拒绝进入，不得降级进入（protocol + map validation 自动测试）
- [x] canonical greybox 确定性、navigation graph 连通、玩家/敌人出生合法、共享碰撞、Supply/Boss 预留区自动测试通过
- [ ] 正式四生态的 Boss 场空间、安全复活点和资源预算自动验证全部通过
- [ ] 四生态视觉风格逐一人工评审（形状/裂纹/音色差异，不能只换颜色）

---

## 9. P7：武器族与命中验证

**前置依赖**：P1 §3.3 Gate 通过（复用同一套 Host 权威校验模式）。可与 P4/P5/P6 **并行**开发（武器命中逻辑相对独立）。

### 9.1 已完成 —— 武器美术资产

- [x] 5 把初始武器 FP+TP：狙击枪、冲锋枪、突击步枪、长矛、剑
- [x] 狙击枪镜片独立网格+材质（ADS 渲染镜内画面）已按规格制作（需人工核对最终 GLB 是否满足此要求）
- [x] 进阶武器链阶段 1/2 模型：光剑（原型/完整体两阶段+完全体三阶段均已交付）、激光枪（基础+Fusion 两阶段）、等离子炮（基础+Singularity 两阶段）、元素法杖（基础+奇点两阶段）

### 9.2 待完成开发项 —— 分武器族命中验证引擎（当前 game-core 仅实现基础 hitscan 单发步枪；2026-08-21 复核：`combat-types.ts` 里 `RifleState` 仍是唯一的武器类型，全仓库对 `sniper|SMG|spear|sword|melee|parry|block|ADS|WeaponFamily` 的检索零匹配——本节内容无变化，5 把起始武器美术资产仍确认在 `apps/web/public/game/models/weapons/starter/` 与 `WEAPONS_Catalog_v01.json` 中就位）

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

### 10.2 待完成开发项 —— 幸存者技能引擎（当前完全未实现；2026-08-21 复核：`packages/game-core/src`、`packages/authority/src` 对 `Warrior|Medic|Guardian|Assassin`/`skill|ability|cooldown` 的检索零匹配；`role-gate.ts` 只有 `nameEn/nameZh/unlockQuestionCount/summaryEn/summaryZh` 五个字段，没有技能/冷却/数值——本节内容无变化）

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

### 11.1 已完成 —— 信令、拓扑与基础 P1 多人战斗

- [x] Host + 最多 7 peers 星形拓扑
- [x] 独立 ACL 校验（作业局校验 `assignment_targets`，自由局校验邀请 ACL/同班级）—— 需要核对是否已在 `join_p2p_room_v1` 完整实现（见 §16.1 安全检查）
- [x] ready/start 流程
- [x] 180 秒重连窗口（membership 层面）
- [x] 5 秒检查点持久化
- [x] 确定性 Host election（按 `joined_at, member_id`）、topology epoch 重连
- [x] 8-browser Playwright 测试覆盖上述拓扑层
- [x] 房间进入 `running` 后切换到真实 Babylon 多人场景，而不是继续停留在大厅
- [x] Host 与 peer 均只提交移动/瞄准/开火/换弹意图；Host 30Hz 模拟并权威结算移动、敌人、命中、伤害、HP、弹药、死亡与重生
- [x] 本机 FP、远端 TP 幸存者/步枪、Thrall 动画与权威 spawn/despawn 已接线；永久 leave 移除 combat/history 实体，临时 disconnect 保留重连状态
- [x] 本地移动预测、Host reconciliation、远端幸存者/Thrall 插值已接入；旧 revision 快照不会回滚展示状态
- [x] 单 Thrall 升级为 stable `entityId` enemy collection；Host-only spawn/despawn、AI/target、HP/death，peer presentation-only；全部敌人按 snapshot 插值并清理
- [x] 最小多人 Wave 状态同步：Host 权威 wave number/kind/phase/revision、remaining、spawn schedule/seed/selection、start/end 与 break；peer HUD 显示相同 Wave/敌人数
- [x] snapshot 携带并校验 topology epoch、room/revision、map hash、enemy/wave revision；enemy tombstone 防止迟到快照复活已 despawn 实体
- [x] checkpoint 单元 round-trip 覆盖 deterministic map + enemy collection + Wave 状态；Host/多 Peer presentation 一致性与 Host→7 peers 同 world-summary Playwright 通过

### 11.2 待完成开发项 —— 高级合作玩法层（基础 P1 多人战斗已完成，但 game-core 仍无多人 Day 共享状态；`PAUSE_GRANTED`/`REQUEST_PAUSE`/五小时强休相关命名全仓库零匹配，`rescue`/`revive` 仍只在协议/内容标签中出现，与救援租约玩法无关。所以下列 Day/救援/暂停/长时会话系统仍是零起点，不能因基础战斗可玩而勾选）

- [ ] Day 状态在多人房间内共享推进（依赖 P5 Day 状态机扩展到多玩家）
- [ ] 完整 late join world reconstruction：认证入场后用当前 map/enemy tombstones/Wave/玩家状态构建同一世界，并验证期间发生 spawn/despawn 时的无缝收敛
- [ ] 完整 reconnect 与 Host migration gameplay restoration：恢复 pending authority/channel、地图/敌人/Wave/玩家战斗状态；checkpoint 版本不支持或恢复失败时安全终止，不能假装成功
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

> 2026-08-21 复核：`packages/game-core/src`、`packages/authority/src`、`apps/web/src` 对 `respawnDelay|bossScale|CLAIM_ULTIMATE|CLAIM_CONTROL|dayContribution|zombiePlayer` 的检索零匹配；`infection` 相关命中全部是卡牌内容的学习扣分资源标签（如 `onFailure: "lose_card_and_10_infection_points"`），与本节的僵尸玩家身体/生命数/感染点机制无关。本节"100% 未开始"判断不变。

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

### 13.2 待完成开发项（主站仓库；2026-08-21 逐条核实，与上一版记录一致，均确认仍未接线）

- [ ] **教师游戏报告 UI**（`get_teacher_game_report_v1` RPC 已在权限白名单里，但前端页面未接线——`app/teacher/assignments/` 下确认没有匹配 `game-report` 的路由，`app/` 内对该 RPC 名的检索零匹配，需要新建 `/teacher/game-reports` 或类似路由）
- [ ] **教师 accommodation 配置 UI**（视觉安全上限/计时策略，写入 `game_assignment_versions.frozen_config`，学生只能进一步降低——RPC `set_game_assignment_accommodation_v1` 已在白名单，`app/` 内对该 RPC 名检索零匹配，`game-unlock-requirements-form.tsx` 里也没有对应控件，前端确认未接）
- [ ] **班级内非对称配对场次入口**：教师在游戏中心创建练习场次，指定班级/时间窗/目标比例，系统在已报名学生中按 1v1/2v1/3v1 自动组队开房（依赖 P10 §12.6 的验证胜场统计逻辑先跑通；全仓库对"asymmetric matchmaking"类描述检索零匹配，确认未做）
- [ ] 教师临时关闭学生游戏权限的入口（教师作业 UI 内未发现停用/暂停/撤销类控件，确认仍需新建或明确复用现有账号停用机制）
- [ ] 学生个人段位/分项学习报告页面（依赖 P12 段位计算引擎完成后才有数据可展示）

### 13.3 待完成开发项（Games 仓库）

- [ ] 学生/教师"游戏中心"页面深化 —— **2026-08-21 核实，比原记录更靠前**：`apps/web/src/app/page.tsx` 不是纯占位，已经渲染 hero + `<MultiplayerLobby/>` + 单人练习 `<GameCanvas/>`；`multiplayer-lobby.tsx` 实现了真实的 WebRTC 建房/加房流程（房间码输入、8 人容量上限、host/menu/connecting/room 多状态，经由 `P2PApiClient`/`WebRtcStarNetwork`）。仍然缺：房间列表/浏览、个人进度或完成情况展示、班级/作业维度的仪表盘——这条待办收窄为"补齐列表与进度展示"，不是"从占位开始建"
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

### 14.3 待完成开发项 —— 日志脱敏（字段白名单；2026-08-21 复核：两个仓库检索 "redact"/"redacted:len" 均零匹配，唯一相关的 `flash-governor.ts` 是客户端闪光频率治理，与日志无关——确认两个仓库都没有相关中间件）

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

- [ ] 进阶武器阶段 3（laser/plasma/staff，依赖 §9.3 的设计决策先做出）全部完成 —— 2026-08-21 复核：三个 `SPEC_PENDING.md` 占位文件仍分别存在于 `laser_stage3`/`plasma_stage3`/`staff_stage3` 目录下，设计决策仍未做出
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

### 16.1 ⬜ 待开发 —— 限速中间件（2026-08-21 复核：`apps/web/src` 内对 middleware/429/Retry-After 等限速相关代码的检索零匹配，确认仍未实现）

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
- [x] ⬜ Production migration 实际执行（见 §2.2.1）—— 已完成 2026-08-16
- [x] 🚫 **`rls_auto_enable()` EXECUTE 收权 migration 审批**（见 §2.2.0-1a）—— 已完成，2026-08-17 现场确认应用到 Production
- [x] ⬜ `rls_auto_enable()` migration 实际执行（见 §2.2.1）—— 已完成，2026-08-21 `get_advisors` 复核确认无残留 PUBLIC EXECUTE 告警
- [x] 🚫 **批准修复 P2P 建房故障的 migration 30**（见 §2.2.0-1b，2026-08-17 起草）—— 已完成，2026-08-21 `list_migrations` 确认 Production 30/30 与 Git 逐条匹配——**这是本次复核发现的最大变化**，上一版记录这一项"尚未应用"
- [x] ⬜ migration 30 实际执行（见 §2.2.1）—— 已完成，随上一条一并确认
- [ ] 🚫 **受限 DB LOGIN 创建与授权**（见 §2.2.0-2）—— migration 链路已全部走完，权限链干净，随时可以做；2026-08-21 复核仓库内无完成证据，仍按未完成处理
- [ ] 🚫 **Games Vercel Production 项目创建**（见 §2.2.0-3）—— 与其余 🚫 项无依赖，可随时单独做；仓库内无 `.vercel`/`vercel.json`，无完成证据
- [ ] ⬜ Games Vercel 环境变量配置（见 §2.2.1，AI 用 Vercel CLI/API 执行，依赖上一条项目创建）
- [ ] 🚫 **`game.ningacademy.org` / `assets.ningacademy.org` DNS 记录**（见 §2.2.0-4）—— 与其余 🚫 项无依赖，可随时单独做；DNS 状态无法从仓库内验证
- [ ] ⬜ R2 四 bucket 创建与 API token（见 §4.3，AI 用 Cloudflare API/`wrangler` 执行）—— 2026-08-21 复核：仓库内无 `wrangler.toml`，确认尚未开始
- [ ] ⬜ Cloudflare Worker 音频代理部署（见 §5.5，AI 用 `wrangler` 执行；生产自定义域路由依赖上面的 DNS 记录）
- [ ] ⬜ TURN 服务器：V1 默认不购买，仅预留接口（`GAME_TURN_*`），后续按需接入（不阻塞发布）
- [ ] ⚠️ Vercel Hobby → Pro 升级评估（若 NingAcademy 属于商业使用，生产发布前必须升级；AI 可评估并给出建议，实际下单付费需要用户用已有账号操作——这是产品/商务决策，不属于本文档 4 类 🚫 范围）
- [ ] ⬜ Supabase 与 Vercel 用量/备份/商业条款按正式使用量在上线门禁复核
- [ ] ⬜ R2 用量监控与配额告警设置（10GB-month 免费额度，默认关闭全量高频回放以保持在额度内）
- [ ] ⬜ **新增**：清空 `scripts/p1/approved-pending-migrations.mjs` 里 migration 30 的豁免条目，恢复 Git-vs-Production 历史比对的完全一致模式（见 §2.2.0-1b）
- [ ] ⬜ **新增**：针对当前 30/30 状态重新跑一次正式的 protected-audit CI（`p1-database-audit.yml` 的 `workflow_dispatch` production-read-only 分支），确认 IA-2-ACL 补丁在真实 CI 里也能清零 ACL diff（见 §2.2.4）

---

## 19. 跨阶段：文档、备份、监控清单

- [x] 2026-08-21 本轮 gameplay 实施后，已同步更新 `docs/todo-v1-rev2.1.md` 与 `docs/project-status-rev2.1.md`，并明确区分基础架构/基础战斗与完整 gameplay
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
