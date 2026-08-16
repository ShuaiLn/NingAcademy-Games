# NingAcademy 3D FPS 学习游戏完整 V1 实施计划（rev2.1 · Boss 独立资产 + WebRTC Host-P2P）

> 本版以 Boss 独立资产修订为内容基线，并将正式多人架构统一为 Babylon.js + WebRTC RTCDataChannel + Host-authoritative P2P + 现有 NingAcademy Production Supabase 信令 + Vercel。Colyseus、常驻专用游戏服和独立 staging Supabase 均已退出正式架构；rev1 或旧 rev2 中被本版修改的条款不得继续引用。

---

## 0. 本版修订清单

| # | rev1 问题 | rev2 处理 |
|---|---|---|
| 1 | 听力音频按内容 hash 上传 R2，URL 即答案信道 | 改为按发布轮换的 HMAC 不透明 key + 90 秒签名 URL + Worker 鉴权；见 §4.8.2 |
| 2 | 兑换、会话和多人连接分散在 Vercel 与专用游戏服域名 | 统一为 `ningacademy.org` 主站与 `game.ningacademy.org` Games Vercel 两个身份域；兑换与 Games API 同源；见 §3.2 |
| 3 | 专用游戏服会话轮换与重连合同不再适用 | Games Vercel 每次 API 调用都校验 HttpOnly Games session；WebRTC 掉线在 180 秒 membership 窗口内重新协商；见 §3.3 |
| 4 | 僵尸阵营 6 槽 + 数值硬上限 → Day 15 后难度饱和 | 新增不占槽、非数值的 Boss 词缀成长轴与精英变体配额；见 §4.1 |
| 5 | 作业题量依赖随机卡，空池静默终止会无限拖 | 新增 `DAY_START` 保底正式题，每 Day 至少 1 道；见 §4.8.4 |
| 6 | `S159` 作废的题是否占「最近 70 道」窗口未定义 | 整条剔除、不占位、窗口向前补足，并加使用门槛；见 §4.7 |
| 7 | 多玩家 Boss 的大招令牌无争用规则 | 新增大招令牌 / 控制令牌的确定性 claim 规则；见 §4.3.3 |
| 8 | 僵尸段位 50 验证胜场 + 无公开匹配 = 不可达 | 阈值下调至 30，并新增教师「班级内非对称配对场次」入口；见 §4.8.5 |
| 9 | Day 20+ 概率合计 101 | 钻石 18 → 17，五行全部合计 100，CI 断言；见 §4.7 |
| 10 | 救援连对要求与总窗口比例失控（地狱 Day 16 约 1.7 秒/题） | 删除固定总窗口，改为「单题限时 × 允许题数」派生模型；见 §4.6 |
| 11 | accommodation 同时乘单题与总窗口，比例错误未解决 | accommodation 只乘单题限时，watchdog 由单题限时派生，比例自动一致；见 §4.6 |
| 12 | 断线 500ms 释放 Claim 与 Host-P2P 掉线检测冲突 | Claim 释放、peer timeout 和 180 秒重连 membership 分层处理；见 §4.6.3 |
| 13 | 2 人合作无法形成「多数投票接管」 | 投票仅在 ≥3 名可行动队友时启用，2 人房自动持锁；见 §4.6.3 |
| 14 | `assignment_kind` 与「第四种作业类型」表述矛盾，`required_for_game` 散布三张表 | P-1 审计后二选一，并统一为 `game_unlock_requirements` / `game_assignment_versions` / `game_assignment_completion_status`；见 §2、§3.5 |
| 15 | 未审计现有 migration 就假设可从零重放 | 新增强制前置阶段 P-1；见 §2 |
| 16 | `academic_terms` 禁止同教师所有学期重叠 | 改为按「教师＋班级/课程」限制，允许 `term_id` 为空并绑定系统学期；见 §3.5.3 |
| 17 | 已发布游戏配置可被教师修改影响进行中对局 | 配置不可变版本化，对局绑定版本 id；见 §3.5.2 |
| 18 | 域名、Games session、信令和撤销职责未闭合 | §3.2、§3.3 统一到 Games Vercel API + Production Supabase，补齐每请求校验、TTL、清理与日志脱敏 |
| 19 | 房间码被当作授权 | 房间码只定位房间，授权由 ACL 独立校验；见 §3.3.4 |
| 20 | IP 限速会误封整个教室 | 账号维度严格、IP 维度宽松分级，认证后不按 IP 封禁；见 §3.3.5 |
| 21 | Supabase 权限模型自相矛盾 | 逐函数写明 INVOKER/DEFINER、owner、EXECUTE 授权与校验内容；私有 schema 的安全边界不依赖 RLS；见 §3.4 |
| 22 | 未说明 Games Vercel 如何以最小权限访问信令库 | 使用 Production Transaction Pooler、server-only 受限凭据并在事务中 `SET LOCAL ROLE games_api`；见 §3.4.3 |
| 23 | 「只保存领域事件」与「保存高频回放」冲突 | 默认不保存高频回放；检查点保存完整权威状态；四个 bucket 分权分保留期；见 §3.6 |
| 24 | `assets.ningacademy.org` 可能暴露学生回放 | 公开域只绑定 assets bucket，CI 断言其余 bucket 无自定义域；见 §3.6 |
| 25 | 只保存 Seed 无法保证客户端一致 | 改为模块化预制布局 + `layout_hash` 校验，完全程序化导航地图推迟 V1.1；见 §4.2 |
| 26 | 承诺数据库「独立回滚」 | 数据库只前滚 + forward-fix，可回滚的是 Games Web/API 与 content；见 §3.7 |
| 27 | 旧规则资产保留到学期结束，运行时需永久维护多版本 | 活跃存档恢复窗口 7 天（个案可延至 14 天），Host runtime 只支持 current 与 N-1；见 §3.7 |
| 28 | 每张卡独立 checkpoint codec | 统一 `card_state` schema；见 §4.7 |
| 29 | 数值/武器/消耗品不占槽可能无限膨胀 | 新增被动总数上限、堆叠合并规则、层数上限、proc/tick CPU 预算与确定性丢弃顺序；见 §4.7 |
| 30 | P3 在核心循环完成前做 9 个职业 | 职业整体后移至 P8 并分两批；见 §5 |
| 31 | 狙击/自动/近战命中验证被当作同一件事 | 按武器族拆分命中验证与延迟策略，近战不使用 rewind；见 §4.4 |
| 32 | 守卫 500 HP 盾相对 100 HP 玩家失衡 | 改为 180 HP 可破坏部署物 + 每秒衰减，且不挡 Boss 大招；见 §4.3.1 |
| 33 | 多僵尸玩家 Boss 的空间优势无法靠拆数值抵消 | 新增最小间距、控制令牌、复活点禁入区、复活保护期随人数增长；见 §4.3.3 |
| 34 | 普通生命耗尽后无条件获得完整 Boss，鼓励送死 | Boss 强度按本 Day 表现分缩放，并加入递增重生延迟；见 §4.3.2 |
| 35 | 每 Day 只随机一名僵尸玩家答题 | 改为全体在线僵尸玩家每 Day 各答一题 + 轮值选卡 + 个人感染点小卡；见 §4.7.3 |
| 36 | （新增需求）答题期间敌人行为 | 答题窗口内普通敌人继续攻击但伤害 10%，倒计时结束即恢复；见 §4.5.1 |
| 37 | （新增需求）暂停 | 任一玩家可暂停，全体同步暂停，有配额与防滥用规则；见 §4.5.2 |
| 38 | （新增需求）听力播放 | 听力音频播放期间世界音（含枪声）硬静音并暂停；见 §4.5.3 |
| 39 | （Boss 资产修订）Boss 母体/共享骨骼会限制造型 | **取消 Boss 母体与 BossCanonical**；4 个 Boss 各自拥有完整独立的 Mesh、Skeleton、动画、材质、贴图、Hitbox、可破坏部件与 manifest，不跨 Boss 共用内容资产 |
| 40 | （Boss 资产修订）Boss 与房屋/草地/沙漠/地狱绑定 | **Boss 与地图生态完全解耦**；四生态只影响地图和普通 Thrall/精英，Boss 从全局 Boss 池选择，不存在“草地 Boss / 地狱 Boss”等分类 |
| 41 | （Boss 资产修订）PvE AI Boss 与玩家 Boss 分成两套资产 | **统一为同一 Boss 池**：猎袭者、巢群者、疫化者、铁壳者 4 个 Boss 都可由 AI 控制用于 PvE，也都可由玩家控制用于非对称；切换的是 Controller，不是模型 |
| 42 | （多人架构修订）专用权威服务器承担世界模拟 | 改为 2–8 人 Host-authoritative WebRTC 星形拓扑；Host 可信并承担模拟，peer 只发送 input/intent；明确接受 Host 作弊风险 |
| 43 | （多人架构修订）Colyseus 负责房间、同步与重连 | 完全移除 Colyseus；Production Supabase 只负责短时信令与 membership，游戏流量通过双 RTCDataChannel 直连 |
| 44 | （多人架构修订）独立 staging Supabase 与三套 staging 域名是发布前置 | 不再创建或依赖 staging；沿用历史审计证据，未来部署在 Production 只读 preflight 和人工批准后前滚 |

---

## 1. 产品结果与发布边界

- 制作桌面与手机浏览器均可完整游玩的 3D FPS：单人 PvE、2–8 人合作、非对称「幸存者 vs 僵尸玩家」。
- 敌人代码和稳定 ID 继续使用 `zombie`，显示名称统一为中文「结晶体」、英文 "Thrall"；全游戏无血液、肢解、肉块或写实尸体。
- 采用完整 262 张 V1 卡池：幸存者 `S001–S162`，僵尸阵营 `Z001–Z100`。旧版 80/40 卡和旧 Phase 0–8 计划废止。
- 不制作全体玩家排行榜。学生只看个人段位与分项学习报告；教师只看自己有权限的学生/班级报告。
- 所有正式成绩均标明「参与度与练习表现，不是学业水平诊断」。
- **P-1 到 P13 全部完成后才对学生公开**；内部预览、20 卡验证版和 110 卡测试版都不是正式 V1。

连接安排：

- 现在不需要 Claude/Anthropic；动态 LLM 不参与判题、战斗、段位或登录。
- **P-1 只需要现有 Production 库的只读访问和本地 Supabase CLI**，不需要新建第二个 Supabase 项目。
- P0 使用独立 NingAcademy Games GitHub 仓库和独立 Games Vercel Project；信令复用现有 NingAcademy Supabase Production。第一条 Production DDL/DML 前必须完成只读 preflight 并取得人工授权。
- P2 资产管线开始时需要 Cloudflare R2 与 `assets.ningacademy.org` DNS 权限。
- 生产发布前只新增 `game.ningacademy.org` DNS 和 Games Vercel 环境变量；不再需要 `play.ningacademy.org`。
- 密钥只通过各平台环境变量配置，不在聊天、Git 或前端包中粘贴。
- Claude 仅可在未来作为教师后台「AI 草拟题目」工具；必须人工审核并冻结后才能发布。

---

## 2. P-1：数据库审计（强制前置阶段）

NingAcademy 生产库近期出现过 migration `RAISE` 语句问题与 RPC 歧义列名问题。无论这些问题现在是否已修复，都不能假设「所有 migration 可从零重放」。P-1 未通过之前，不允许设计任何游戏表、不允许写任何游戏 migration。

### 2.1 P-1 步骤

1. **核对 Git migration history**：导出 `tutoring/supabase/migrations` 全量文件清单、执行顺序与逐文件 SHA-256，产出 `git_migrations.csv`。
2. **核对 Supabase migration history**：查询目标库 `supabase_migrations.schema_migrations`，导出已登记版本与时间戳，产出 `db_migrations.csv`。
3. **核对生产数据库真实 schema**：`pg_dump --schema-only --no-owner --no-privileges` 导出真实结构（表、列、约束、索引、函数、触发器、RLS 策略、grant），产出 `prod_schema.sql`。
4. **全新本地 Supabase 完整重放**：`supabase db reset` 从零重放全部 migration，产出 `replay_schema.sql`，并与 `prod_schema.sql` 做结构化 diff。
5. **确认作业类型真实存储方式**：查清普通作业、背单词、朗读三类分别落在哪些表、如何下发目标、如何记录截止日期、如何做班级权限、如何保存历史快照。
6. **然后再设计游戏表**。

### 2.2 P-1 必须产出的三份文档

- `MIGRATION_DRIFT_REPORT.md`：三方 diff 结果，逐条列出「Git 有 / 库没有」「库有 / Git 没有」「两边都有但结构不同」，每条给出处理决定（补 migration / 写 forward-fix / 接受并记录）。
- `REPLAY_FAILURES.md`：从零重放失败的每一条，以及修复方式。已知需要排查的类型：
  - `RAISE` 缺少 `EXCEPTION` 子句、格式串参数个数不匹配；
  - RPC 内列名与参数名同名导致歧义（修复口径：所有参数加 `p_` 前缀，所有列引用写成 `schema.table.column`）；
  - 函数缺少 `SET search_path`；
  - 依赖执行顺序但未声明的对象。
- `ASSIGNMENT_MODEL_REPORT.md`：三类作业的真实存储模型，并给出 §3.5.1 中「方案 A / 方案 B」的选择结论与理由。

### 2.3 P-1 验收门槛

- 全新本地 Supabase 从零重放 **零失败**。
- 重放结果与生产 schema 的 diff **零未决项**（每条要么已修复，要么已在报告中记录为有意差异）。
- CI 新增作业：每个 PR 在临时数据库重放全部 migration，并对关键对象（表、函数签名、RLS 策略、grant）做快照断言。
- 三份报告经人工确认后，P0 才能开始。

---

## 3. 架构、身份和数据合同

### 3.1 仓库与部署

采用两个 Git 仓库、两个 Vercel 部署单元：

1. `NingAcademy`：现有主站、账号、班级、作业、游戏入口和全部 Supabase migrations，部署到现有 Main Vercel Project。
2. `NingAcademy-Games`：独立 monorepo 与独立 Games Vercel Project：
   - `apps/web`：Next.js + Babylon.js、`/redeem`、Games session 与同源 P2P 信令 API。
   - `packages/game-core`：纯 TypeScript 权威规则。
   - `packages/protocol`、`authority`、`content`、`testkit`。

不存在常驻 multiplayer server 或第二套多人 fallback。`game-core` 不依赖 React、DOM、Babylon 或网络 transport；采用版本化随机数流、领域事件和检查点恢复，不实施跨机器 bit-level lockstep。

多人使用 2–8 人星形拓扑：创建者为 Host，最多维护 7 条 `RTCPeerConnection`，peer 之间不互连。Host 浏览器以 30Hz 运行权威世界，peer 最多发送 30 组 input/intent/秒；Host 约 15Hz 发送紧凑 snapshot/event。可靠的 `ning-control-v1` channel 承担房间生命周期、技能、伤害事件、卡牌、答题、救援与结果；`ordered=false`、有限重传的 `ning-realtime-v1` channel 承担高频 input/snapshot。命中判定在 Host 保存至少 250ms 历史，hitscan 最多回退 200ms，只回退命中盒、枪口和遮挡。

Host 是模拟信任边界：用户已接受 Host 修改本地模拟和结果的作弊风险；这不扩大任何数据库权限。非 Host peer 只能发送 input/intent，不能提交或覆盖权威 world state。单人模式完全使用 `LocalAuthority`，不创建房间或 WebRTC 连接。

membership 的重连窗口为 180 秒。Host 每 5 秒提交有序检查点；Host 掉线后由 Supabase 按 `(joined_at, member_id)` 确定性选出新 Host、递增 topology epoch、清除旧信令，所有 peer 重建星形连接并从最新检查点继续。若检查点无效或迁移失败，安全终止房间并明确提示，不假装成功恢复。

### 3.2 域名职责与身份链

**正式身份链只使用两个同属 `ningacademy.org` 的应用域；平台默认域不得参与 Production 身份链。**

| 域名 | 承载 | 归属 |
|---|---|---|
| `ningacademy.org` | 登录、班级、作业、签发一次性票据 | 主站 |
| `game.ningacademy.org` | 独立 Games Vercel：兑换、Host-only Games session、同源信令 API、Babylon.js 前端 | Games Vercel 自定义域 |
| `assets.ningacademy.org` | 只读公开资产 CDN（**只绑定 assets bucket**） | R2 自定义域 |

不创建 NingAcademy-staging，也不维护 staging 域名、数据库 secret 或 migration parity。既有 staging 报告保留为历史审计证据，但未来数据库发布只面向共享 Production，并严格遵循只读 preflight → 人工批准 → 前滚 migration。

**兑换流程：**

```text
1. 学生在 ningacademy.org 登录
2. 主站 POST /api/game/launch-ticket → 60 秒一次性票据（256-bit 随机值，只存 hash，只能兑换一次，不放 URL）
3. 浏览器以表单 POST 提交票据到 https://game.ningacademy.org/redeem（票据只在 body）
4. Games Vercel 原子兑换成功 → 设置 __Host-ning_game_session
     Secure; HttpOnly; SameSite=Strict; Path=/；无 Domain 属性（Host-only）
5. Games Vercel 返回 303 See Other → https://game.ningacademy.org/
6. Games Web 通过同源、带 Cookie 的 API 创建或加入房间；API 每次重新校验 Games session
7. API 以受限 Production 数据库角色写入短时 offer/answer/ICE 信令
8. 浏览器完成 ICE 协商后，游戏流量只经 Host ↔ peer RTCDataChannel；Supabase 不模拟世界
```

`/redeem` 只接受精确表单 POST；校验 `Origin` 与 Fetch Metadata，拒绝 query token、Authorization fallback、伪造/过期/重放票据。兑换页和 API 均使用 `Cache-Control: no-store`、`Referrer-Policy: no-referrer`，兑换前不加载分析或第三方资源。

Games API 不接受普通 Supabase JWT、客户端 `user_id`、localStorage token 或第二种登录方式。浏览器永远拿不到数据库 secret；身份唯一来自已验证的 Games session。

### 3.3 会话、撤销、授权与限速

#### 3.3.1 Games session 与 WebRTC 重连

- Games session 绝对上限 5 小时 15 分钟；到期后必须回主站取得新票据。Cookie 始终为 `Secure; HttpOnly; SameSite=Strict; Path=/` 且无 `Domain`。
- `/api/session`、所有信令 mutation、heartbeat、ready/start/checkpoint/leave/end 均在 Games Vercel 重新调用数据库会话校验，不信任浏览器缓存身份。
- peer 短暂断线时，原 membership 在 180 秒内保持可重连；客户端用同一 Games session 重新轮询 topology epoch 并协商 WebRTC，Host 在 channel 打开后立即发送当前 snapshot。
- membership 心跳 12 秒超时触发 disconnect。非 Host 可在窗口内回归；Host 超时触发 §3.1 的确定性迁移。超出窗口或 session 已撤销则必须重新取得授权，不允许 fallback token。

#### 3.3.2 撤销传播

主站登出、密码修改、账号停用、强制改密、学生转教师、作业失去资格时，现有数据库触发器/RPC 立即撤销 Games session。之后：

1. 任一 Games API 调用都会拒绝已撤销 session。
2. 客户端至少每 5 秒通过同源 room poll/heartbeat 重新验证；失败即关闭所有 peer connection 并清空本地 session 状态。
3. Host 同步移除该 member，必要时由 Supabase 递增 topology epoch 并重建星形连接。

**「5 秒内感知撤销」是 SLO。** P12 必须验证 `revocation_latency_p95 ≤ 5s`、`p99 ≤ 15s`；无常驻进程、LISTEN/NOTIFY 或实例 presence 依赖。

#### 3.3.3 日志脱敏

- 结构化日志采用**字段白名单**，不是黑名单。
- 以下 key 永不进入任何日志（Main Vercel、Games Vercel、浏览器诊断、Postgres 分别配置）：`ticket`、`token`、`cookie`、`set-cookie`、`authorization`、`answer`、`answer_hash`、`question_text`、`audio_url`、`sdp`、`candidate`。
- 序列化中间件在写出前按 key 替换为 `[redacted:len=N]`。
- CI 增加一条测试：对样本日志 grep `__Host-`、`ticket=`、`answer`、`Bearer `，命中即失败。
- Postgres 侧 `log_statement = 'ddl'`，禁止 `all`；`log_min_duration_statement` 只记录耗时，不记录参数。

#### 3.3.4 房间码不是授权

- 房间码使用 6 位无歧义大写字符（`A-HJ-NP-Z2-9`），例如 `N7K4PQ`，**只用于定位房间**；唯一索引与有限重试防碰撞。
- `join_p2p_room_v1` 必须独立校验全部条件，缺一不可：
  1. 会话有效且未被撤销；
  2. 账号未停用、未被教师临时关闭游戏权限；
  3. 作业局：玩家在该 `game_assignment_version` 的 `assignment_targets` 内；
  4. 自由局：玩家在房主的邀请 ACL 内，或与房主同班级且教师允许自由局；
  5. 玩家并发房间数 ≤ 1；
  6. 房间未满、未结算、协议版本匹配。
- 无公开房间浏览、自由聊天或公共匹配。
- 房间码尝试失败按**账号**计数：10 次/10 分钟 → 锁定 30 分钟。

#### 3.3.5 限速（教室共享公网 IP）

一间教室里几十个学生共享一个公网出口 IP，因此 IP 限速必须比账号限速宽松，否则会误封整个教室。

| 维度 | 端点 | 限制 | 超限行为 |
|---|---|---|---|
| 账号 | 登录 | 10 / 5 分钟 | 递增退避 |
| 账号 | 签发票据 | 6 / 分钟 | 429 |
| 账号 | 兑换票据 | 6 / 分钟 | 429 |
| 账号 | 房间码尝试 | 10 / 10 分钟 | 锁定 30 分钟 |
| peer | RTC 高频 input | 30 / 秒 | Host 丢弃并计数 |
| peer | RTC 可靠命令 | 10 / 秒 | Host 拒绝并计数 |
| peer | RTC 总量 | 64 / 秒硬上限 | Host 关闭该 peer |
| 账号 | 信令发送 | 120 / 分钟 | 429；重复 SDP/ICE 幂等去重 |
| IP（未认证） | 登录、兑换 | 默认 300 / 分钟 | 429 |
| IP（已认证） | 全部 | 默认 1200 / 分钟 | **只告警，不封禁** |

- 识别为「教育共享出口」（同 IP ≥8 个不同已登录账号且全部通过认证）时自动提升到 3000 / 分钟并只告警。
- **永不基于 IP 封禁已认证账号**；IP 硬限制只对未认证端点生效。
- 教师后台可申报教室出口 IP 段加入白名单。
- RTC 应用消息最大 64KiB；信令 payload 最大 64KiB；snapshot 必须分包或改 binary encoding，不允许无界 JSON 广播。

### 3.4 Supabase 权限模型

#### 3.4.1 安全边界的准确表述

Supabase 只强制要求**暴露给 Data API 的 schema** 的表启用 RLS。私有 schema 的安全边界是：**不暴露 Data API + 角色无表权限 + 函数白名单**，RLS 在这里是纵深防御，不是唯一防线。参见 [Supabase RLS 文档](https://supabase.com/docs/guides/database/postgres/row-level-security)。

Schema 分工：

- `public`：现有账号/班级/作业和安全公开 RPC。**启用 RLS 并 `FORCE ROW LEVEL SECURITY`**（防止表 owner 自身绕过）。
- `game`：局、玩家、个人结果、答题尝试、个人段位快照、内容版本元数据。
- `game_private`：票据、游戏会话、正确答案快照、幂等键、撤销 outbox、实例 presence、审计。

角色：

- `game_api_owner`（NOLOGIN、NOINHERIT、NOBYPASSRLS）：拥有游戏合同对象和 `SECURITY DEFINER` 函数；不是运行时凭据。
- `games_api`（NOLOGIN、NOINHERIT、NOBYPASSRLS）：Games Vercel 的最小权限 group role；对任何表零权限，只能 `EXECUTE` 明确白名单的 `game.*_v1/v2` RPC。
- Production 运维创建一个可登录、无 owner/service-role 权限的 server-only credential，仅授予其 `games_api` membership；凭据只进入 Games Vercel secret。旧 `game_server` 保留为无权限历史角色或后续安全删除，不创建 staging/prod 专用游戏服 LOGIN。

固定 DDL：

```sql
REVOKE ALL ON SCHEMA game, game_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA game TO games_api;
REVOKE ALL ON SCHEMA game_private FROM games_api;
-- 不授予任何表级权限
ALTER DEFAULT PRIVILEGES IN SCHEMA game, game_private REVOKE ALL ON TABLES FROM PUBLIC;
```

所有 `SECURITY DEFINER` 函数一律 `SET search_path = ''`，所有对象完整 schema 限定。Games Vercel **不使用** `SUPABASE_SECRET_KEY`、service_role 或数据库 owner；浏览器没有任何数据库凭据。

#### 3.4.2 逐函数安全合同

| 函数 | 模式 | Owner | 谁可 EXECUTE | 函数内必须校验 |
|---|---|---|---|---|
| `public.get_game_access_status(uuid)` | DEFINER | `game_api_owner` | `authenticated` | `auth.uid()`、Scheme B 解锁快照、作业目标与账号状态 |
| `public.issue_game_launch_ticket_v1(...)` | DEFINER | `game_api_owner` | `authenticated` | `auth.uid()` 非空、账号有效、解锁完成、签发限速；只存 token hash、TTL 60s |
| `game.redeem_game_launch_ticket_v1(text)` | DEFINER | `game_api_owner` | `games_api` | 原子单次消费、expiry、资格重新校验；返回不含普通 Supabase JWT 的 Games session |
| `game.validate_game_session_v2(uuid)` | DEFINER | `game_api_owner` | `games_api` | session 未过期/撤销、账号仍有效、返回绑定的 user/student/assignment version |
| `game.create_p2p_room_v1(...)` / `game.join_p2p_room_v1(...)` | DEFINER | `game_api_owner` | `games_api` | session、membership、ACL、2–8 容量、6 位 code、协议版本与房间 TTL |
| `game.poll_p2p_room_v1(...)` / `game.send_p2p_signal_v1(...)` | DEFINER | `game_api_owner` | `games_api` | sender/recipient 必须属于同一房间、只允许 Host 星形边、payload ≤64KiB、信令 TTL 2 分钟 |
| `game.set_p2p_ready_v1(...)` / `game.start_p2p_room_v1(...)` | DEFINER | `game_api_owner` | `games_api` | membership、Host-only start、至少 2 人且全员 ready |
| `game.save_p2p_checkpoint_v1(...)` | DEFINER | `game_api_owner` | `games_api` | 当前 Host、topology epoch、单调 sequence、payload ≤512KiB、敏感 key 拒绝 |
| `game.leave_p2p_room_v1(...)` / `game.end_p2p_room_v1(...)` | DEFINER | `game_api_owner` | `games_api` | membership/Host 权限；离开时确定性选 Host，递增 epoch 并清除旧信令 |
| `game.cleanup_p2p_data_v1()` | DEFINER | `game_api_owner` | `games_api` | 只清理到期信令、过期房间和过期 membership；结果可审计 |
| `public.get_my_game_profile_v1()` / `public.get_teacher_game_report_v1(...)` | INVOKER/DEFINER | `game_api_owner` | `authenticated` | RLS 或显式教师所有权；不得由 Games 浏览器绕过 |

规则补充：

- 面向浏览器的读取优先用 `SECURITY INVOKER` + RLS；只有需要跨 schema 或跨权限时才用 `DEFINER`。
- `game_api_owner` 拥有相关对象，因此 `DEFINER` 函数不能把 RLS 当成自身唯一校验；每个 RPC 必须显式绑定 session、actor、room 和 membership。`NOINHERIT/NOBYPASSRLS` 保护运行时角色本身，不替代函数内授权。
- `public` 中所有含学生数据的表使用 `FORCE ROW LEVEL SECURITY`。

#### 3.4.3 Games Vercel 连库

- Games Vercel route 使用 Supabase **Transaction Pooler** 的 SSL server-only URL，以适应 serverless 短生命周期；不把连接字符串注入任何 `NEXT_PUBLIC_*` 环境变量。
- 连接首先以最小权限 LOGIN 建立，每个事务执行 `SET LOCAL ROLE games_api`，再调用参数化白名单 RPC；禁止任意 SQL 拼接和 direct table query。
- 每个实例连接池上限 4；`statement_timeout = 3s`；`idle_in_transaction_session_timeout = 5s`；请求结束后释放连接。
- 数据库不可用时：房间创建/加入/持久化明确失败；已经建立的 P2P 世界可短时继续，答题/结果进入待重试状态，不判错、不扣血。不得将数据库故障转换成客户端任意写入。

### 3.5 作业与解锁数据模型

#### 3.5.1 作业类型：P-1 已确认方案 B

`docs/p1/ASSIGNMENT_MODEL_REPORT.md` 已用 Production 只读审计确认方案 B：普通作业（`public.assignments`）、词汇（`public.vocabulary_sets`）和朗读（`public.pronunciation_tasks`）是三个永久独立的父表，各有 targets、due date、发布和完成模型。`assignments.assignment_kind` 只区分 `plain | game`，不把词汇或朗读塞进普通作业父表。

`public.assignables` 是只包含三类可作为前置作业的窄注册层：每行通过真实 FK 精确关联 `assignment_id`、`vocabulary_set_id` 或 `pronunciation_task_id` 之一。注册层不复制业务字段，也永远不包含 `assignment_kind = 'game'`，从结构上排除游戏解锁游戏的循环。

#### 3.5.2 统一解锁与不可变版本

- `public.game_assignment_versions` 以 `(game_assignment_id, version_no)` 记录不可变配置快照、教师、request id 和 requirements hash；教师修改要求时插入新版本并原子切换 `game_assignment_configs.current_unlock_version_id`。
- `public.game_unlock_requirements` 用 FK 指向一个 `assignables` 行，同时冻结 kind/title/due/sort order 供历史审阅。版本和 requirement 的 `UPDATE/DELETE` 均由触发器拒绝。
- `public.game_assignment_completion_status` 以 `(game_assignment_version_id, requirement_id, student_id)` 为主键缓存逐要求完成证据；FK 同时约束 assignment/version/requirement 一致性。
- `get_game_access_status(uuid)` 每次从已认证的 `auth.uid()` 推导 student，重新计算三种 source-of-truth completion，再更新缓存；浏览器不能提供或冒充 student id。
- launch ticket 与 Games session 都绑定不可变的 `game_assignment_version_id`。教师中途发布新版本不改写在途对局或历史结果。
- 方案 B 已在 `20260815170000_game_unlock_scheme_b.sql` 实现并通过历史 staging 审计；未来仅按 Production 只读 preflight 与批准结果部署，不再维护 staging 分支合同。

#### 3.5.3 教师学期（`academic_terms`）

rev1 的「同一教师的活动学期不能重叠」是错的：暑期班、补课班和普通班本来就会重叠。

```sql
create table public.academic_terms (
  id              uuid primary key default gen_random_uuid(),
  teacher_id      uuid not null,
  scope_class_id  uuid null,        -- null = 该教师的默认学期
  name            text not null,
  starts_on       date not null,
  ends_on         date not null,
  timezone        text not null,
  is_system       boolean not null default false,
  check (ends_on > starts_on)
);

-- 只在「同教师 + 同班级/课程」范围内禁止重叠
alter table public.academic_terms
  add constraint academic_terms_no_overlap
  exclude using gist (
    teacher_id      with =,
    coalesce(scope_class_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    daterange(starts_on, ends_on, '[]') with &&
  );
```

- 同一教师可以同时有多个不同班级/课程的学期。
- 自由练习**没有教师学期**：`term_id` 允许为空，或绑定固定的系统学期 `is_system = true`（UTC、永不结束）。
- 保留期计算：绑定教师学期的记录按「学期结束 + 30 天」；`term_id` 为空或系统学期的记录按「该玩家最后活动 + 180 天」。

### 3.6 持久化、bucket 与保留期

#### 3.6.1 Host 只通过 Games API 持久化两类数据

高频世界模拟只存在于 Host 与 peer，不进入 Supabase 信令。持久化边界为：

**（1）领域事件（低频，Postgres）**：答题提交与判定、卡牌获取与应用、Day 推进、Boss 生成与死亡、玩家倒地/救援/永久死亡、职业与武器变更、暂停请求与恢复、结算。答题在判定时实时、幂等写入；数据库不可用时暂停并重试，不判错、不扣血。

**（2）检查点（Host 权威状态）**：tick、全部 RNG 流状态、所有实体位置/速度/朝向/AI 状态机、玩家 HP/护甲/武器/弹药/消耗品/卡牌状态/机制槽、配额进度、Day 状态机、题目游标、救援状态、感染点、暂停配额。Host 每 5 秒经 Games API 保存一个有序、≤512KiB 的热检查点到当前 P2P room；检查点必须自足，供 Host migration 使用。需要 7 天恢复的正式存档再由 Games API 写入私有 R2，保留最近两代。

**默认不保存全量高频回放。** 用户已接受 Host 作弊，因此不建立伪装成高可信反作弊的后台。高频片段只在学生/教师申诉、Host runtime 异常或管理员手动导出时由参与者明确上传，每次最多事件前后 30 秒、≤2MB。

> 容量核算以最大 8 人房、≤512KiB 热检查点和低频领域事件为上界重新压测；P2P 游戏流量不经过 Vercel、Supabase 或 R2。R2 不是无限存储，长期存档启用前必须绑定配额告警。

#### 3.6.2 四个 bucket 分权

| Bucket | 自定义域 | 访问方式 | 保留期 |
|---|---|---|---|
| `ning-game-assets` | `assets.ningacademy.org` | 公开只读 CDN | 随 `content_release`，旧版保留至 N-1 下线 |
| `ning-game-checkpoints` | **无** | 仅 Games Vercel server routes，S3 API + 专用 token | 最近两代；对局结束后 7 天 |
| `ning-game-replays` | **无** | 仅后台签名 URL（TTL ≤5 分钟） | 14 天 |
| `ning-game-anticheat` | **无** | 仅管理员签名 URL | 90 天且不超过「学期结束 + 30 天」 |

- 四个 bucket 使用四组独立 R2 API token，最小权限，互不可读。
- **CI 断言：只有 `ning-game-assets` 允许绑定自定义域**，其余三个 bucket 一旦出现自定义域或公开访问策略即构建失败。
- `assets.ningacademy.org` 绝不出现学生回放、检查点或题目答案。
- 默认不保存高频回放同时也降低了对未成年学生行为轨迹的收集量。

#### 3.6.3 保留与删除

- 个人明细保留到教师学期结束后 30 天（自由练习按最后活动 + 180 天），供导出和申诉；之后删除原始答案、题目实例、个人事件、段位明细，剩余统计必须不可逆匿名化且不能回连个人。
- 票据 24 小时内清除。
- 账号删除立即提前执行撤销和匿名化。

### 3.7 版本、升级与回滚

#### 3.7.1 发布 manifest

每个发布固定：`tutoring_commit / db_contract_version / protocol_version / simulation_version / ruleset_version / content_release_id / generator_version / asset_manifest_id`。

#### 3.7.2 升级顺序

```text
扩展 DB（前向兼容）→ Games Web/API → 激活 content → 下一个次版本再清理旧合同
```

#### 3.7.3 数据库只前滚

rev1 承诺「数据库、运行时、web、content 均可独立回滚」，这对数据库不成立：写入新格式后无法像 Vercel 部署那样安全回滚 migration。本版明确：

- **可独立回滚的是 Games `web/API` 与 `content_release`**；Host runtime 随 web bundle 发布，不是独立服务器部署。
- **数据库只前滚**：
  - 所有 migration 必须前向兼容（只加列、只加表、只加函数重载）；
  - 禁止在同一版本内删除旧列、旧函数、旧枚举值；删除动作至少滞后一个次版本；
  - 出问题一律用 forward-fix migration，不用 `down` 脚本；
  - CI 断言：任一 migration 若含 `DROP COLUMN` / `DROP FUNCTION` / `ALTER TYPE ... DROP VALUE`，必须在文件头注明它所废弃的合同版本号且该版本已下线。

#### 3.7.4 版本支持窗口

rev1 的「旧存档所需规则和资产保留到对应学期结束」会导致 Host runtime 永久维护多套规则（教师可以创建很长的学期）。本版改为：

- Host runtime 只支持 **current 与 N-1** 两个 `protocol_version` / `simulation_version` / `ruleset_version`。
- **活跃存档恢复窗口 7 天**；管理员可对个案延长至 14 天。
- 超出窗口的存档转为「只读历史结果」，可查看、可导出、可申诉，但不能继续对局。
- 历史结果、学习记录、段位快照的可读期与「能否继续对局」完全解耦，仍按 §3.6.3 保留。
- 协议不兼容时显示「游戏正在更新」。

#### 3.7.5 统一 checkpoint schema（取代每卡独立 codec）

```ts
type CardState = {
  card_id: string;      // S001–S162 / Z001–Z100
  stacks: number;       // 获取层数，0–5
  charges: number;      // 运行时充能
  cooldown_until: number; // tick
  custom_i32: [number, number, number, number];
  custom_f32: [number, number, number, number];
};
```

- 每张卡最多使用这 4 + 4 个自定义槽，不允许扩展。
- 需要更多状态的卡设计一律驳回或拆分。
- 好处：检查点 codec 只有一份，卡池从 20 → 110 → 262 时序列化代码零改动。

---

## 4. 完整玩法、学习与表现规则

### 4.1 Day、地图、Boss 与难度曲线

每局只选择一个生态，地图同时决定战斗难度：

| 地图 | 难度 | equivalent Day 系数 | 敌对实体上限 |
|---|---|---:|---:|
| 房屋 | 简单 | 0.8 | 20 |
| 草地 | 普通 | 1.0 | 30 |
| 沙漠 | 困难 | 1.2 | 40 |
| 地狱 | 地狱 | 1.5 | 50 |

`equivalentDay = floor(1 + (actualDay - 1) × 系数)`，幸存者段位使用 equivalent Day。

- Day 1 普通怪配额 30，每 Day +5；基础配额和数值成长在 Day 20 封顶。
- 状态机固定为：

```text
DAY_START            ← 保底正式题（见 §4.8.4）
→ ZOMBIE_CARD
→ QUOTA_COMBAT
→ QUOTA_CLEANUP
→ BOSS_TRANSITION
→ BOSS_COMBAT
→ SUMMON_CLEANUP
→ RESCUE_RESOLUTION
→ DAY_END_CHECKPOINT
```

#### 4.1.1 Day 20 之后的成长轴（修复饱和问题）

僵尸阵营只有 6 个共享机制槽，且总加成硬上限为 HP +35% / 伤害 +25% / 速度 +20%，因此数值成长约在 Day 12–15 就撞顶。rev1 让曲线在 Day 20–50 走平，却又要求 equivalent Day 50 才能到吊炸天。rev2 增加两条**不占机制槽、不受数值上限约束**的成长轴（它们改变行为，不堆数值）：

**（1）Boss 词缀 `boss_affix`**

- Day 20 起，每 5 个 Day 解锁 1 个词缀，最多 6 个。
- 词缀池示例（改变行为，不加数值）：额外阶段、召唤节奏改变、地形交互（封门/断电/塌陷）、技能组合（两个技能同时释放）、对救援的针对性行为、护盾相位。
- 词缀由 Host 按 Day、match seed 与 `boss_id` 确定性抽取，**不以地图生态筛选**；peer 只接收 id 列表。
- 词缀不进入 HP/伤害/速度硬上限计算。

**（2）精英变体配额比例**

- Day 20 起，普通怪配额中精英变体占比 `min(30%, 5% + 1.5% × (Day - 20))`，Day 37 达到 30% 上限。
- 精英变体是不同的行为模板（护盾型、爆裂型、牵引型、干扰型），不是「HP 更高的普通怪」。
- 精英变体计入配额，计入敌对实体上限。

#### 4.1.2 其他 Day 规则

- 幸存者没有每日免费卡；只有贡献进度达到门槛才触发三选一。
- PvE 每 Day Host 从合法僵尸卡中随机选一张，100% 成功并应用全体敌人。
- 配额完成即停止普通重生和所有召唤；清理剩余普通体后进入 Boss。
- **Boss 使用统一全局池，与地图生态无关。** V1 Boss 池固定为：猎袭者 Boss、巢群者 Boss、疫化者 Boss、铁壳者 Boss。不存在房屋/草地/沙漠/地狱专属 Boss。
- **PvE**：每个 Boss 阶段由 Host 从全局 Boss 池中确定性选择 1 个 `boss_id`，并挂接 AI Controller。4 个 Boss 都必须支持 PvE AI 控制。
- **非对称**：不加载另一套“玩家 Boss”资产；每名僵尸玩家进入 Boss 阶段时使用同一全局 Boss 池中的 Boss 资产并挂接 Player Controller。V1 默认沿用僵尸职业到对应 Boss 的映射（猎袭者→猎袭者 Boss、巢群者→巢群者 Boss、疫化者→疫化者 Boss、铁壳者→铁壳者 Boss），因此 4 个 Boss 全部可被玩家操作。
- **控制器可切换、资产不可切换**：同一个 `boss_asset_id` 在 AI / Player 两种控制方式下必须使用同一 Mesh、Skeleton、动画资源、材质、Hitbox 与可破坏部件；玩家断线时只把 Controller 切为 AI，180 秒内重连后切回 Player，不换模型。
- Boss 死亡前产生的召唤物必须清完：50% HP、50% 伤害、100% 速度，不计配额、卡牌进度、掉落或感染点。
- Boss 死亡后仍倒地的玩家可以继续被救援；全部召唤物和救援/永久死亡都结算后才进入下一 Day。
- 僵尸玩家退出由 AI 接管身体或同一个 Boss，180 秒内可重连认领。
- 全部僵尸玩家永久离开后转为 PvE；转换前段落保留在非对称参与/学习记录，但不产生非对称胜场，转换后的 Day 不进入合作段位。
- 幸存者主动退出不算僵尸击杀；幸存者全部主动退出为 `NO_CONTEST`。
- 普通阶段 90 秒无进度执行重寻路/迁移，180 秒替换不可达实体；普通阶段、Boss 和召唤清场分别有版本化 watchdog，管理员可保存后终止异常房间。

### 4.2 地图确定性（模块化预制布局）

rev1 明确不做 bit-level lockstep，却让每个 peer 凭 seed 自行重建地图。只要生成过程涉及浮点、不同浏览器实现、生成器版本差异、资产尺寸变化或 navmesh 更新，peer 视觉就可能与 Host 碰撞不一致。

rev2 改为：**V1 使用经过验证的模块化预制布局组合，完全程序化导航地图推迟到 V1.1。**

Host 保存并下发：

```text
seed
generator_version
canonical_layout_id
collision_layout_id
layout_hash
asset_manifest_id
module_placements[]   // { module_id, grid_x, grid_y, rotation ∈ {0,90,180,270} }
```

- 生成器只决定「哪个预制模块放在整数网格的哪一格、朝哪个方向」，不生成几何体。
- 房间/走廊/开阔地/Boss 场模块由人工制作，碰撞体与 navmesh **随资产预烘焙**，随 `asset_manifest_id` 发布，不在运行时生成。
- peer 加载完成后本地计算 `layout_hash` 并与 Host 下发值比对；不一致则拒绝进入并提示「资源版本不匹配，请刷新」。
- 生成器逻辑变更 = 递增 `generator_version`；旧存档在支持窗口内继续使用旧版本模块包（受 §3.7.4 的 current/N-1 约束）。
- 发布前自动验证：连通性、导航可达、出生点、Boss 场空间、安全复活点、资源预算。

### 4.3 职业

共同基准：幸存者 `100 HP / 20 护甲`。首个职业由玩家免费永久解锁；其他职业需完成 10 道无时限题且首答正确率至少 60%。已解锁的非首发职业每次开局选择时需答对一道无时限确认题。错误立即反馈并换新题重试；这些题进入学习报告但不计作业最低题量或段位。

#### 4.3.1 幸存者职业

| 职业 | 基础差异 | 两个主动技能 |
|---|---|---|
| 战士 | 105 HP、22 护甲、武器/近战伤害 +5% | 8 米战吼：队伍伤害 +12%、换弹/近战速度 +10%，6 秒 / 45 秒；6 米震荡锥：60 伤害、AI 硬直 0.6 秒，25 秒 |
| 医疗 | 治疗 +10%、武器伤害 −3% | 8 米治疗脉冲：4 秒恢复 20% 最大生命，45 秒；6 米救援屏障：减伤 30%，8 秒 / 60 秒 |
| 法师 | 95 HP、18 护甲、技能/状态伤害 +5%、武器伤害 −3% | 四目标递减奥术跳跃，20 秒；6 米冰霜领域 6 秒，AI 减速 35%、玩家体 15%、Boss 10%，35 秒 |
| 刺客 | 95 HP、18 护甲、移速/弱点/近战 +5% | 6 米 Host 权威扫掠突进，无无敌，12 秒；弱点标记 10 秒，队伍弱点 +15%、Boss +8%，35 秒 |
| 守卫 | 110 HP、30 护甲、伤害/移速 −3% | **晶盾（改）**：180 HP 可破坏部署物，每秒自然衰减 12 HP，最长 8 秒，冷却 45 秒；8 米 AI 挑衅 4 秒并自身减伤 20%，冷却 35 秒，不强制玩家僵尸 |

**守卫晶盾修正说明**：rev1 的 500 HP 盾相对于玩家 100 HP 基准是 5 倍体量，会让守卫在场时的战斗完全脱离伤害模型。rev2 改为：

- 180 HP + 每秒衰减 12（即使不受伤也最多存在 8 秒）；
- 只阻挡投射物与近战，**不阻挡 Boss 大招与范围地面效果**；
- 同时在场最多 1 个，新盾覆盖旧盾；
- 盾被击破时给守卫 2 秒 15% 减伤作为补偿，而不是延长盾。

#### 4.3.2 僵尸玩家职业

僵尸玩家职业与普通体身体模板分离；死亡换体不重置技能冷却。Boss 阶段切换到对应的**全局独立 Boss 资产**与 Boss 技能；该 Boss 资产同时也是 PvE 可用 Boss，不存在单独的“玩家 Boss 模型”或“AI Boss 模型”：

| 职业 | 基础差异 | 两个主动技能 |
|---|---|---|
| 猎袭者 | HP −3%、移速/近战 +3% | 6 米飞扑，下一击 +25%，12 秒；15 米狩猎标记 6 秒，僵尸伤害 +6%，25 秒 |
| 巢群者 | 直接伤害 −5% | 召唤轮盘：基础体 10 感染点、特殊体 20，20 秒冷却、最多 4 只；10 米 AI 移速/攻速 +10%，6 秒 / 30 秒 |
| 疫化者 | HP −3%、能力伤害 +5% | 18 米腐蚀投射物，14 秒；4 米污染区 6 秒、每秒 8 伤害且治疗 −10%，28 秒 |
| 铁壳者 | HP +5%、移速 −3% | 7 米冲撞，120% 近战伤害、击退和 0.4 秒硬直，16 秒；前方 120° 减伤 30%，4 秒 / 22 秒 |

僵尸玩家相对同模板 AI 的基础 HP、伤害、速度各 +5%。最终总加成硬上限（含职业与卡牌）：HP +35%、伤害 +25%、速度 +20%。

**普通体生命与重生（修复送死套利）**

- 每 Day 玩家普通体生命数为 `min(20, 3 + floor((Day-1)/3))`。
- **重生延迟（新）**：第 1–4 次死亡后 8 秒重生；第 5 次起每次 +2 秒，上限 20 秒。
- 生命耗尽则观战到 Boss 阶段，但仍进入与其职业对应的全局 Boss——**强度不再无条件为满值**；这里仅切换 Controller/玩法状态，不加载一套专属玩家 Boss 资产：

```text
bossScale = 0.7 + 0.3 × min(1, dayContribution / dayContributionTarget)
```

- `dayContribution` 来自：造成的有效伤害、承受的伤害、召唤物存活时间、阻止幸存者推进配额的时间、感染点获取。
- 故意快速送掉普通体 → `bossScale = 0.7`，且失去本 Day 的感染点结余。
- 正常发挥 → `bossScale = 1.0`。
- `bossScale` 同时缩放 HP、DPS 与召唤预算，不缩放移动能力。

**感染点**

只来自有效 HP 损失：每 10 伤害 1 点，10 点/分钟、40 点/Day；同一目标短时间重复收益按 100%/50%/25%，30 秒重置。护甲、盾、过量伤害和治疗后重复刷血不产生收益。

#### 4.3.2A Boss 资产与控制合同（rev2.1）

- V1 只有 **4 个 Boss 内容资产**：猎袭者、巢群者、疫化者、铁壳者。
- 每个 Boss 都是独立完整资产包；**禁止 `BossCanonical`、Boss Base、Boss 母体、跨 Boss 共用 Skeleton、跨 Boss 共用动画文件、跨 Boss 共用 Mesh/材质/贴图/可破坏件**。
- 允许统一的是运行时接口合同，例如 `boss_id`、动画状态名、socket 语义、Hitbox 数据格式和 Controller API；这些只是接口规范，不代表底层资产共享。
- 每个 Boss 必须同时通过两套控制验收：`AIController`（PvE）与 `PlayerController`（非对称）。Controller 切换不得改变 `boss_asset_id`。
- Boss **不包含 biome / ecosystem 绑定字段**。地图生态只决定场景、普通 Thrall/精英的生态挂件与表现；任何 Boss 都必须能在房屋、草地、沙漠、地狱 Boss 场合法生成。

#### 4.3.3 多名僵尸玩家 Boss 的共享预算（补空间与令牌规则）

rev1 只拆分了 HP / DPS / 召唤预算，但多个身体带来的地图控制、夹击、技能覆盖和复活点封锁**无法靠拆数值抵消**。rev2 增加空间预算与令牌：

**数值预算**

- 固定总 HP、总 DPS、总召唤预算按人数均分；`bossScale` 逐人应用后再求和。
- 移动能力不拆分。

**空间预算（新）**

- 任意两个玩家 Boss 之间强制最小间距 12 米；违反时由 Host 把**较晚进入该区域**的 Boss 权威推开，带 0.5 秒硬直。
- 安全复活点半径 8 米为「Boss 禁入区」；Boss 进入后 2 秒内被强制位移出去，并进入 5 秒该点禁入冷却。
- 幸存者复活保护期由 3 秒改为 `3 + 1 × (僵尸玩家数 − 1)` 秒，上限 6 秒。

**令牌规则（新，修复大招争用未定义）**

- Host 持有**一个大招令牌**与**一个控制令牌**，两者独立。
- 任一 Boss 发送 `CLAIM_ULTIMATE` / `CLAIM_CONTROL`；Host 按**到达 tick 升序**排序，同 tick 按 `player_id` 字典序升序，胜者唯一。
- 胜者获得 3 秒施法权；失败者收到 `*_DENIED`，进入 2 秒本地再申请冷却，**不消耗技能冷却**。
- 大招令牌使用后共享冷却 40 秒；控制令牌使用后共享冷却 15 秒。共享冷却期间任何 Boss 都不能施放对应类别的技能。
- 令牌状态进入检查点与领域事件，回放可验证。

### 4.4 武器、伤害与命中验证

初始武器：狙击枪、冲锋枪、突击步枪、长矛、剑。枪械使用 ADS；长矛和剑使用格挡/蓄力。

#### 4.4.1 按武器族拆分命中验证（rev1 把三类当成同一件事）

| 武器族 | 命中方式 | Host 校验 | 延迟策略 |
|---|---|---|---|
| 狙击枪 | hitscan 单发 | ADS 时长、移动速度、开火间隔、后坐恢复 | 200ms rewind |
| 突击步枪 | hitscan 连发 | 射速节流、**扩散状态机由 Host 权威计算**（peer 只预测视觉） | Host 最多 200ms rewind |
| 冲锋枪 | hitscan 高射速 | peer 每 tick 最多 2 发；Host 按射速上限裁剪，超出丢弃并计数 | Host 最多 200ms rewind |
| 长矛 / 剑 | 胶囊扫掠 | **不使用 rewind**；Host 在 300ms 攻击窗口内按自身权威位置插值判定 | peer 只播放动画，命中一律等 Host 确认 |
| 格挡 | 状态区间 | Host 记录格挡开始/结束 tick，伤害结算按 Host 区间判定 | 不接受 peer「我当时在格挡」 |

近战不 rewind 的代价是 150ms 下命中反馈有可感延迟，但可以避免「攻击者本地已挥中、Host 上目标早已离开」这类无法调和的误判。P7 必须在 0/75/150/200ms 下分别录制近战手感并人工评审。

#### 4.4.2 武器槽与升级

- 默认一个主武器槽；`S076` 增加第二槽。
- 同链升级原位替换并继承链被动；跨家族旧武器进入局内个人兵器库，只能在 Day 边界更换。
- V1 不允许丢弃或分享武器；每人有 3 个消耗品槽和 1 个部署物槽。
- 三阶段武器链补齐：
  - `S161 聚变激光 / Fusion Laser`，钻石，需 S045：激光伤害 +25%、热量增长 −20%，弱点命中每 250ms 最多散热 5%；`S075` 改为需要 `S161`。
  - `S162 奇点等离子炮 / Singularity Plasma Cannon`，黑金，需 S063：命中产生 4 米吸引 2 秒后 240 等离子爆发，内部冷却 30 秒。

#### 4.4.3 伤害结算

护甲为第二 HP 池。结算顺序固定：

```text
基础伤害 → 弱点 → 暴击 → 攻击方/卡牌
→ 元素抗性 → 格挡 → 护甲 → HP → 状态
```

- 暴击和弱点各 1.5 倍，组合上限 2.5 倍；元素抗性限制在 ±50%；同类 DoT 最多 5 层。
- 普通 CC 连续 2 秒后递减；玩家僵尸所受 CC ×0.5 且单次最多 1 秒；Boss 使用韧性条。
- 答错的 10 点真实伤害绕过护甲，但最多降到 1 HP，不能直接致死。

### 4.5 答题保护、全体暂停、听力静音（新增系统）

#### 4.5.1 答题保护

- **答题窗口**定义为：题面下发并显示 → 玩家提交答案或倒计时归零。
- 窗口内，**普通敌人（含 Boss 召唤物）继续正常攻击**，但该玩家受到的伤害为原来的 **10%**。
- Boss 本体伤害减免为 **50%**；答题窗口内 Boss 不会开始一击致命大招（已在前摇中的不打断）。
- **倒计时结束（提交或超时）即刻恢复 100%，无缓冲、无渐变。** Host 与 peer 都以 `question_window_closed_tick` 为唯一判据。
- 该规则统一适用于三种答题场合：卡牌题、救援题、`DAY_START` 保底题。
- `S023` 在救援场合额外乘 0.88，与本规则叠乘（`0.10 × 0.88 = 0.088`）。
- 答题保护不使玩家无敌：护甲、DoT、状态、坠落伤害照常，只是数值 ×0.10 / ×0.50。
- 答题保护进入领域事件与检查点，回放可验证。

#### 4.5.2 全体同步暂停

**任一玩家请求暂停，全体同步暂停。**

- 请求：`REQUEST_PAUSE` → Host 广播 `PAUSE_GRANTED { requester, expires_at_tick }`，所有 peer 在同一 tick 冻结。
- **冻结**：战斗时钟、题目时钟、救援时钟与租约、Boss 时钟、配额、生成、AI、卡牌冷却、暂停配额本身。
- **不冻结**：5 小时墙钟、认证与会话轮换、健康检查、断线检测、检查点心跳。
- **暂停期间禁止**：移动、开火、换弹、拾取、使用技能、选卡、提交答案；输入一律丢弃。
- **题目处理（防偷看）**：暂停瞬间题面立即隐藏并冻结计时；恢复时**该题作废，改发一道等价新题，倒计时完整重置**。作废不计错、不扣血，但记录 `paused_during_question` 供教师报告。这样暂停既不能用来争取思考时间，也不会惩罚真有急事的学生。
- **配额**（合作与非对称）：

| 地图 | 每局全房总次数 | 每名玩家每 Day | 单次最长 | 每 Day 累计最长 |
|---|---:|---:|---:|---:|
| 房屋 | 6 | 1 | 120 秒 | 300 秒 |
| 草地 | 5 | 1 | 120 秒 | 300 秒 |
| 沙漠 | 4 | 1 | 90 秒 | 240 秒 |
| 地狱 | 3 | 1 | 90 秒 | 240 秒 |

- **单人模式**：随时可暂停，不消耗配额（无公平性问题）；5 小时墙钟仍不冻结。
- **恢复**：任一玩家发 `REQUEST_RESUME`，全员同意或到达 `expires_at_tick` 自动恢复；恢复前 3 秒全员倒数提示。
- **防规避**：Boss 大招前摇的 1.5 秒内锁定暂停请求，防止用暂停躲技能。
- **非对称**：僵尸玩家配额独立，规则相同。
- 暂停请求、授予、恢复全部进入领域事件；`pause_seconds_total` 计入教师报告的「用时」列，但**不计入学习正确率、不计入段位**。

#### 4.5.3 听力播放期间世界音暂停

- 音频总线分为 `learning` 与 `world` 两条。
- **正式听力题音频播放期间，`world` 总线进入 `hard_duck`：增益归零，且暂停所有一次性音效实例的调度**（枪声、爆炸、晶体撞击、Boss 咆哮、脚步、环境音全部停止）。不是降低音量，是硬静音 + 暂停。
- 播放结束后 200ms 淡入恢复；期间被抑制的一次性音效**不补播**。
- UI、字幕、命中提示、弱点轮廓等**视觉信息照常显示**，保证听障或静音玩家不丢信息。
- 学习音频永远不随慢动作变速（沿用 rev1 规则）。
- **这是纯本地表现层行为**：不影响 Host 时钟、伤害判定、AI 或配额。「枪声静音」不等于「敌人停止攻击」——敌人行为由 §4.5.1 的答题保护单独处理。
- 玩家若已关闭音效或使用文本替代（`text_alternative`），不触发本机制。

### 4.6 多人救援（重新设计计时模型）

#### 4.6.1 rev1 的问题

rev1 同时规定「总窗口 45/35/25/20 秒（每 5 Day −3 秒，最低 25/20/15/12 秒）」和「连对要求 `2/3/4 + floor((Day-1)/5)`，上限 5/6/7」，两者独立，导致：

- 地狱 Day 1：总窗口 20 秒 ÷ 连对 4 = 平均 5 秒/题；
- 地狱 Day 16：连对 7、总窗口最低 12 秒 = 平均约 1.7 秒/题，**物理上不可能**；
- 1.5×/2× accommodation 同时乘单题与总窗口，比例保持不变，**根本没有解决比例错误**。

#### 4.6.2 rev2 模型：删除固定总窗口，由单题限时派生

```text
maxQuestions   = streakRequired + tolerance
perQuestion    = 学习难度限时(25 / 18 / 12 秒) × accommodation
watchdogWindow = maxQuestions × perQuestion × 1.15      // 仅防卡死，正常玩法不会触发
```

| 地图 | Day 1 连对要求 | 成长 | 上限 | 容错次数 | 每 Day 每人可被救援次数 |
|---|---:|---|---:|---:|---:|
| 房屋 | 2 | 每 10 Day +1 | 4 | 3 | 3 |
| 草地 | 2 | 每 10 Day +1 | 4 | 3 | 3 |
| 沙漠 | 3 | 每 10 Day +1 | 5 | 2 | 2 |
| 地狱 | 3 | 每 10 Day +1 | 5 | 2 | 2 |

- **删除**「总窗口 45/35/25/20 秒」与「每 5 Day −3 秒」。
- **删除**「连对要求 `2/3/4 + floor((Day-1)/5)`，上限 5/6/7」。
- accommodation **只乘单题限时**；`watchdogWindow` 由单题限时派生，因此 1×/1.5×/2× 的每题节奏完全一致，比例错误彻底消失。
- 校验：地狱 Day 16 → 连对 `3 + floor(15/10) = 4`，容错 2，最多 6 题，每题 12 秒（困难难度）。地狱 Day 1 → 连对 3，容错 2，最多 5 题，每题 12 秒。两者都是合理节奏。
- 答错只清零连对、消耗一次容错，不扣血。容错耗尽或 watchdog 触发 → 救援失败。
- 时间压力不再来自「越来越短的总窗口」，而来自三点：救援者无法战斗导致配额停滞与敌人堆积、救援者在题目之间承受 100% 伤害、**每 Day 每人可被救援次数上限**（超出则该次倒地直接进入永久死亡判定）。

#### 4.6.3 Claim 租约（消除 rev1 的三重冲突）

rev1 同时写了「断线 500ms 释放」「8 秒无活动释放」「20 秒活动租约」，三者互相冲突。rev2 拆成**三条互不重叠的释放路径**：

| 路径 | 触发条件 | 释放时机 |
|---|---|---|
| **立即释放** | 救援者死亡、倒地、RTCDataChannel 关闭、3 秒无 Host 心跳、主动取消、被救者永久死亡 | Host 检测后 **≤500ms**（这是测试口径） |
| **无活动释放** | 救援者仍在线且存活，但 8 秒内既未提交答案也无 `typing` 心跳 | 8 秒 ± 0.5 秒 |
| **总占用上限** | 单次 Claim 累计占用 | 45 秒 × accommodation（最高 ×2 → 90 秒）强制释放 |

- **删除「20 秒活动租约」**。续租改为：每提交一次答案、或每 2 秒一次 `typing` 心跳即续租，但总占用仍受 45 秒 × accommodation 约束。
- Claim 必须在授予后 5 秒内开始第一题，否则按「无活动」释放。
- 暂停期间租约与总占用一并冻结。

#### 4.6.4 接管与 2 人房（修复多数投票不成立）

- **可行动队友 = 1 名**（含 2 人房）：该队友**自动持有 Claim 权，无需投票**。
- **可行动队友 ≥ 3 名**：才启用投票接管，需 ≥2 票且严格多数（3 人可行动 → 2 票；4 人可行动 → 3 票）。投票时排除被救者与当前 Claim 持有者。
- **可行动队友 = 2 名**：不投票；当前持有者主动放弃则立即转移给第一个请求者，否则等待自然释放路径。
- 任何人数下，当前持有者主动放弃 → 立即转移给第一个请求者。
- **2 人房唯一队友无法行动**（倒地/死亡/永久死亡）→ 无救援可能，直接进入永久死亡判定。

#### 4.6.5 救援结算

- 救援者不能移动或攻击，无无敌；答题窗口内受到伤害为 10%（§4.5.1），再乘 `S023` 的 0.88。
- 成功后在安全导航点以 30% HP 复活，保护期 `3 + 1 × (僵尸玩家数 − 1)` 秒（上限 6 秒），不能攻击、无碰撞，保留武器和已生效卡。
- 单人没有普通自救，只有明确的复活卡。
- 永久死亡删除该玩家的续玩资格但保留历史与学习记录；团灭删除房间续玩存档。

### 4.7 卡牌

最终目录为幸存者 162、僵尸 100。每张卡转换为有限、可校验的 DSL，禁止任意 JavaScript，至少包含：稳定 ID、双语与本地化、版本、rarity、min_day、权重与合法性表达式、获取层数与运行时充能分离、trigger/target/effect operation/单位/持续/冷却/重置范围、机制槽与冲突与硬上限与递减收益、模式/生态/职业/武器/段位/作业策略、生成预算与阶段阻塞与奖励归属、**统一 `card_state` checkpoint schema（§3.7.5）**、网络可见性、VFX/SFX 及低动态替代。

#### 4.7.1 抽取概率（每行合计 100）

| Day | 白 | 银 | 金 | 钻石 | 黑金 |
|---|---:|---:|---:|---:|---:|
| 1–2 | 100 | 0 | 0 | 0 | 0 |
| 3–5 | 70 | 30 | 0 | 0 | 0 |
| 6–11 | 45 | 35 | 20 | 0 | 0 |
| 12–19 | 25 | 30 | 30 | 15 | 0 |
| 20+ | 15 | 35 | 30 | **17** | 3 |

- rev1 的 Day 20+ 合计为 101（钻石 18）。rev2 改为 17，五行全部合计 100。
- **CI 断言：概率表每行合计必须 = 100**，Host runtime 不依赖运行时归一化掩盖数据错误。策划表、测试断言和 UI 显示三处使用同一份数据文件。

#### 4.7.2 抽取、槽位与膨胀控制

- 三张候选必须不同；非法、冲突、满栈卡先过滤，重复数值卡权重为 `base/(1+stacks)`。
- 过滤为空时自动重算一次；仍为空则本次机会结束，不发题、不扣血、不给临时补给。（题量由 §4.8.4 的保底题保证，不再受此影响。）
- 每名幸存者 6 个机制槽；僵尸阵营共享 6 个机制槽。满槽时先选择替换对象，再发题，答错保留旧卡。

**膨胀控制（rev1 缺失）**——数值、武器和消耗品不占机制槽，长局会累积大量常驻效果，必须加上限：

- **常驻被动总数上限 24**（机制槽 6 + 数值/武器/消耗品被动 18）。达到上限后三选一只提供「替换 / 升级」选项，不再提供新增。僵尸阵营共享上限同为 24。
- **每张卡最大层数 5**，卡片可声明更低值，不可声明更高。
- **堆叠结算顺序固定**：

```text
1. 同类加法先合并求和
2. 乘法按类别顺序相乘：职业 → 卡牌 → 临时增益 → 环境
3. 最后套用硬上限（HP +35% / 伤害 +25% / 速度 +20% 等）
```

- **同类乘法采用收益递减合并**：`1 + Σ( effect_i / (1 + 0.15 × i) )`，其中 `i` 为该类别内第 i 个来源，按 `card_id` 升序确定顺序（保证确定性）。
- **proc 预算**：默认不能重新触发来源效果；最大链深 4；单根事件最多 32 个派生效果；**每 tick 每房间派生效果 ≤512**。
- **每 tick CPU 预算 3ms**（30Hz 下 tick 预算 33.3ms 的 9%）。
- **超预算时的确定性丢弃顺序**：`纯视觉 → 非伤害辅助 → 低优先级 DoT 刷新 → 数值 proc`；同优先级内按 `(priority_class, card_id, source_entity_id)` 三元组升序丢弃，保证 Host 与所有 peer 结果一致；每次丢弃记录 `proc_budget_exceeded` 事件。
- 事件索引预编译，禁止每 tick 扫描 262 张卡。

#### 4.7.3 获取与答题

- 首 5 次成功获得卡牌每次需 10 贡献点；之后每累计 5 次成功获取，门槛 +5，最高 50。贡献包括击杀、助攻、有效治疗/护盾、控制、承伤、救援、补给与目标贡献，并带反刷上限。
- 选卡后才发题；答对原子应用卡牌，答错/超时卡失效并扣 10 点非致死真实伤害，立即显示正确答案和短解释。未选卡超时只失去机会。
- **PvE**：僵尸卡无题目、100% 生效。
- **非对称（rev2 改）**——rev1 每 Day 只随机一名僵尸玩家答题，导致其他僵尸玩家几乎没有学习内容。改为：
  - **每 Day 全体在线僵尸玩家各答一道自己的冻结题**（题源、难度、accommodation 各自独立，题面/答案互不广播）。
  - 由**当日轮值者**（按加入顺序轮转，不随机重复）执行三选一选卡。
  - **卡牌生效条件**：答题者中正确比例 ≥ 50%（向上取整）→ 卡生效并全阵营共享；否则卡失效，全阵营扣 10 感染点。
  - 每名答错者个人额外扣 5 感染点（个人责任），不影响他人。
  - 仅 1 名僵尸玩家时退化为原规则（答对即生效）。
  - 这样每名僵尸玩家每 Day 至少 1 道正式限时题，学习量与幸存者可比。
- **僵尸个人小卡（新）**：每累计 30 感染点触发一次个人三选一，从 `Z` 池中标记 `personal_scope` 的子集（约 30 张）抽取，只影响自己的身体，**不占阵营 6 槽，占个人 3 槽**，同样需答题。
- 玩家操控体也获得全部僵尸共享卡，再应用个人 +5% 和职业修正。

#### 4.7.4 特殊卡约束

- `Z093 Boss 双星`只能拆分固定 Boss 预算；`Z084` 分魂和所有 Boss 召唤物必须完成清场。
- `S121` 服从同对手/同 Day 反刷：首次完整、后续 25%，额外进度最多 1 点/对手/Day。
- 个人死亡保护只允许持有 `S070/S078/S139/S148` 中一张；`S160` 单独占团队机制槽。优先级：S139 → S148 → S070 → S078 → S160。
- **`S159 因果改写`（补齐 rev1 缺失定义）**：
  - 每局一次；
  - 原始错误记录**不可删除**，标记 `causally_voided`，显示答案并改发新题；
  - **该记录从「最近 70 道正式限时首答」窗口中整条剔除，不占位**，窗口向前多取一条补足；
  - 该错误不进入段位聚合、不进入作业正确率；
  - 原始记录仍出现在学生学习报告与教师报告中，并明确标注「已因果改写」；
  - **使用门槛**：本局该玩家的正式题总数 ≥10 才能使用，防止开局刷卡；
  - 伤害或道具只生成补偿事件，不回滚位置、其他玩家、Boss、配额或数据库世界。

#### 4.7.5 开发顺序

20 张代表卡覆盖全部原子操作 → 显式混合稀有度的 60 张幸存者 + 50 张僵尸内部池 → 完整 162 + 100 并全部通过组合测试。

### 4.8 学习、作业与个人段位

#### 4.8.1 题型

英译中；中译英；英语听力拼写；数学计算、填空、判断。

正式题目只下发题面和 `question_instance_id`，正确答案只存在于 Host 的内存快照与 `game_private` 判题合同中。输入提交只含 `request_id / question_instance_id / answer`。Host 作弊风险已接受，但普通 peer 仍不能读取他人的答案或数据库记录。

#### 4.8.2 听力音频（消除答案泄露信道）

rev1 按内容 hash 上传 R2，同一个词永远是同一个 URL，学生答一次就能建立「URL → 答案」映射并互相传表，直接抵消「答案只在权威端」。本版改为：

- **对象 key 不透明且随发布轮换**：

```text
object_key = base32( HMAC-SHA256(content_release_salt, word_id || voice_id || variant) )[0:32]
```

- `content_release_salt` 每次内容发布轮换，**只存在于 `game_private`**，不进入客户端、不进入 CI 制品。
- **客户端拿不到 object key**：题目实例下发的是短时签名 URL，TTL 90 秒，绑定 `question_instance_id` 与游戏会话。
- 签名 URL 经 Cloudflare Worker 代理，Worker 校验会话 Cookie 与 `question_instance` 归属后才回源；**R2 音频 bucket 本身不公开、无自定义域**。
- 同一次发布内，同一个词对不同学生随机下发 3 个语音变体之一；跨发布 URL 全部变化。
- **审计**：同一学生对同一 `question_instance_id` 最多请求 3 次音频，超出记反作弊标记。
- 正式听力仍采用固定 Kokoro-82M v1.0 本地批处理生成、人工抽检、Opus 转码；自由练习可用 `SpeechSynthesis`（不走 R2、不产生泄露）。参见 [Kokoro 项目](https://github.com/hexgrad/kokoro)。
- 不存在麦克风权限、录音上传、Speech Recognition、语音输入或朗读复活。
- 听力改文本必须标记 `text_alternative`，不计听力或段位正确率，教师报告单列。

#### 4.8.3 输入与复习

- 中文 IME 必须正确处理 composition，组合期间 Enter/快捷键不能提交；Pointer Lock 恢复、移动键盘和安全区单独测试。
- 错题同一 Day 不重复；至少间隔 5 题，并按 1/3/7 天复习。复习不改写首答。
- 同一合作房每人使用自己的冻结题源、难度、学期和 accommodation；任何人的题面、答案、Tier 或策略都不广播。
- 教师 accommodation 优先于房主；支持 1×、1.5×、2×、无时限。视觉安全策略与学习计时策略分别保存，不记录诊断或原因。
- 「无时限」在实时救援中按 2× 处理，其他题目仍真正无时限。

#### 4.8.4 `DAY_START` 保底正式题（保证作业题量）

rev1 的作业题量全部来自贡献点触发的三选一，而合法卡池为空时又「本次机会结束、不发题」，导致战斗表现差的学生可能无限拖延。rev2 增加保底：

- **每个 Day 的 `DAY_START` 固定下发 1 道正式限时题**，与卡牌完全解耦。
- 答对无奖励、答错**不扣血、不失去任何东西**，只记录。
- 计入作业最低题量、计入段位正确率（它是正式限时首答）。
- 这道题的答题窗口同样适用 §4.5.1 的答题保护。
- 效果：默认作业条件「Day 3 + ≥5 道正式限时首答 + ≥60% 正确率」最迟在 Day 5 就能满足题量，不再依赖运气。

作业完成条件：

- 默认：达到 Day 3、至少 5 道正式限时首答、正确率 ≥60%；Day 3 题量不足则继续到两项都满足（保底题保证最多到 Day 5）。
- 教师可提高条件。由于保底题的存在，「不允许只依赖随机卡确保题量」这条约束现在在机制上成立，不再是空话。
- 完成个人当前全部解锁条件（`game_unlock_requirements`）后，该玩家才能切换到教师允许或自己的自由题池；同房玩家互不影响。

#### 4.8.5 个人段位

个人段位仅在对局永久结算时重算；检查点、5 小时休息或中途保存不重算。正确率取最近 70 道正式限时首答（`causally_voided` 记录整条剔除、不占位），至少 35 道才结束「定位中」。

幸存者单人和合作段位分别记录：

| 显示段位 | equivalent Day | 正确率 |
|---|---:|---:|
| 青铜 | 初始 | — |
| 白银 | 6 | 65% |
| 黄金 | 12 | 70% |
| 铂金 | 20 | 75% |
| 钻石 | 25 | 85% |
| 大师 | 30 | 90% |
| 吊炸天 | 50 | 95% |

僵尸个人段位采用「验证胜场 ＋ 正确率」。rev1 的 50 场在「只认 1v1/2v1/3v1 且无公开匹配」的前提下实际不可达，rev2 下调并补配对入口：

| 显示段位 | 验证胜场（rev1 → rev2） | 正确率 |
|---|---|---:|
| 青铜 | 初始 | — |
| 白银 | 3 → **3** | 65% |
| 黄金 | 6 → **5** | 70% |
| 铂金 | 12 → **9** | 75% |
| 钻石 | 20 → **14** | 85% |
| 大师 | 30 → **20** | 90% |
| 吊炸天 | 50 → **30** | 95% |

- 只有 1v1、2 名幸存者 vs 1 名僵尸、3 名幸存者 vs 1 名僵尸进入僵尸胜场统计；趣味比例和多僵尸房仍可玩但不产生验证胜场。
- **新增「班级内非对称配对场次」**：教师在游戏中心创建一个练习场次，指定班级、时间窗和目标比例；系统在该班级已报名学生中自动按 1v1 / 2v1 / 3v1 组队开房，产出验证胜场。这是仅有的自动配对形式，范围严格限定在单个教师的单个班级内，不构成公共匹配。
- 答错会降低滚动正确率，并可能在最终结算时降段。

### 4.9 无血表现、可访问性与设备

#### 4.9.1 命中表现

- 普通命中：共享 shader 裂纹和短促边缘发光；
- 弱点：核心暴露、轮廓变化和独立高频音；
- 击杀：局部限亮闪光、10–20 片晶体解析轨迹碎裂，0.5 秒内溶解成光尘；
- 精英/Boss：增加冲击波和同步终结演出；
- **普通 Thrall 与精英**随地图生态表现：房屋为紫色晶质，草地为绿色孢子化，沙漠为风沙崩解，地狱为黑曜/橙色余烬；形状、裂纹和音色也必须不同，不能只换颜色。**Boss 不继承地图生态外观，每个 Boss 保持自己的固定视觉语言。**
- 致命元素决定主终结效果，次强状态只作为 25% 边缘色，不产生第二次死亡。

Host 只发送紧凑命中/死亡 cue；碎片不进入物理、网络、检查点或回放。

#### 4.9.2 时间效果

- 本机 hit-stop：普通 30ms、弱点 60ms、击杀 80ms；100ms 内合并最高档，滚动 1 秒累计最多 120ms。只暂停武器 rig、目标受击动画和表现时钟，不暂停输入、移动预测、网络、射速、AI、题目或 Host。
- quota 普通体清空后，Host 同步 0.3 秒、20% 速度 Boss 转场演出。
- Boss 致死后同步 1.2 秒、15% 速度终结演出；战斗/救援/题目游戏时钟暂停，认证、5 小时墙钟和健康检查不停。之后继续召唤物清场。
- 关闭慢动作的玩家在相同 Host 时间线停顿期显示静态状态提示，不能改变共享时间线。
- 学习听力音频独立播放，绝不随慢动作变速；播放期间世界音按 §4.5.3 硬静音。

#### 4.9.3 可访问性

音效分层包括武器瞬态、晶体撞击、弱点音、碎裂、低频冲击和 UI 确认；必要信息同时提供字幕/图标。门、围栏、灯光与停电等环境变化由 Host 判定；尖啸扭曲必须可单独关闭。

教师发布作业时逐项设置视觉安全上限（写入 `game_assignment_versions.frozen_config`，不可变）；学生只能进一步降低。学生偏好默认仅存 IndexedDB，不进入教师报告。支持：

- 屏幕震动 0–100；hit-stop 开关；闪光 Off/Reduced/Normal；碎片 Off/Reduced/Normal；尖啸扭曲开关；慢动作开关；镜头晃动与动态模糊默认关闭；手柄震动和分层音量独立设置；一键「减少动态效果」。

实现全局 `FlashGovernor`，滚动 1 秒最多 2 次高对比闪光，比 WCAG 2.2 的「三次或以下」阈值更严格；无全屏纯白或饱和红闪。参见 [WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold)。

#### 4.9.4 设备目标

- WebGL2 为 V1 唯一路径；WebGPU 后置 V1.1。
- 手机与桌面完整跨平台，不分输入池；记录输入类型用于审计。
- 手机横屏双摇杆、按钮、安全区、轻度瞄准减速和小范围可见目标磁吸；无自动开火、穿墙锁定。
- 手机基线：4GB 中端设备、动态 540–720p、稳定 30fps。
- Iris Xe：720p/30；GTX1650：1080p/60。
- 大厅 ≤15MB，选定生态可玩资源 ≤50–60MB，完整生态 ≤80MB；移动低档可玩资源 ≤45MB，不预载其他生态。
- 晶片池 Low/Medium/High 为每次 10/14/20、全局 80/168/320；池满优先 Boss、本玩家击杀和最近可见目标，否则整次退化为 GPU 粒子。
- 结晶表现新增下载 ≤8MB、GPU 常驻 ≤16MB、解码音频 ≤8MB；禁止每次命中创建新 Mesh、Material、ParticleSystem 或 Audio 节点。

---

## 5. P-1 到 P13 实施顺序与云节点

rev1 把 9 个职业放在 P3（核心 Day、Boss、卡牌、地图都还没做），顺序不合理。rev2 把职业整体后移并分两批，同时把武器按族拆成独立阶段。

| Phase | 实施与验收 | 云依赖 |
|---|---|---|
| **P-1** | 数据库审计：Git/Production migration 核对、全新 CI 临时库从零重放、作业类型真实存储确认；产出并保留 `MIGRATION_DRIFT_REPORT.md`、`REPLAY_FAILURES.md`、`ASSIGNMENT_MODEL_REPORT.md`。历史 shared-environment 验证证据保留；未来 Production 发布前重新只读 preflight。 | Production 只读凭据 + 本地 Supabase CLI |
| **P0** | 独立 Games monorepo；建立 `game`/`game_private`、Scheme B、`game_api_owner`/`games_api` 白名单合同、P2P room/member/signal TTL；实现 `/redeem`、Games session、Create/Join、6 位房间码、STUN、双 RTCDataChannel、2 浏览器 smoke test；跑通「主站→票据→Games Cookie→信令→P2P→一道题→结果」闭环。Production migration 在批准点前停止。 | 现有 Production Supabase（批准后）、Games Vercel |
| **P1** | 平地图、一把 hitscan 突击步枪、一种 Thrall、移动/HP/死亡、Host 30Hz authority、Host 最多 200ms rewind；peer 只能 input/intent，拒绝权威状态覆盖、瞬移、伪造击杀、超射速和无弹药射击。 | — |
| **P2** | Babylon 场景、预测/reconciliation、远端插值、手机触控、结晶裂纹/碎裂、**音频总线（learning/world 分离）**、全部可访问性、FlashGovernor；接入 R2 四 bucket 与 `assets.ningacademy.org`，完成目标设备性能门槛。 | R2、assets DNS |
| **P3** | 题目系统：四类题、冻结音频（不透明 key + 签名 URL + Worker 鉴权）、Games API 幂等判题与 Host 结果应用、IME/mobile 输入、错题复习、accommodation、题目隐私、**答题保护（§4.5.1）**、**听力静音（§4.5.3）**。 | Cloudflare Worker |
| **P4** | 卡牌 DSL、20 张代表卡、三选一、机制槽、替换、硬上限、**被动总数上限与 proc/CPU 预算与确定性丢弃**、答题伤害、**统一 `card_state` checkpoint schema**。 | — |
| **P5** | Day 配额、状态机、`DAY_START` 保底题、PvE 每日僵尸卡；完成 **4 个独立 Boss 资产**（猎袭者/巢群者/疫化者/铁壳者）并让 4 个全部通过 AI Controller；Boss 池与地图生态解耦；Boss 词缀与精英变体成长轴、watchdog、**全体同步暂停（§4.5.2）**；连续 10 Day 无卡死。 | — |
| **P6** | 房屋→草地→沙漠→地狱四生态**模块化预制布局组合**；`layout_hash` 客户端校验；连通、导航、出生、Boss 场、安全复活点和资源预算自动验证。 | — |
| **P7** | 武器分族落地：狙击枪（ADS/蓄力精度）、冲锋枪（射速裁剪）、突击步枪（Host 权威扩散）、长矛/剑（**不 rewind** 的胶囊扫掠 + Host 权威格挡区间）；武器槽与兵器库；0/75/150/200ms 手感人工评审。 | — |
| **P8** | 职业：**第一批**战士/医疗 + 猎袭者/巢群者跑通框架，**第二批**补齐法师/刺客/守卫 + 疫化者/铁壳者；守卫晶盾按 §4.3.1 新数值；永久解锁题与每局确认题。 | — |
| **P9** | 2–8 人合作：Host + 最多 7 peers 的星形拓扑、独立 ACL、ready/start、救援与接管、180 秒重连、5 秒检查点、确定性 Host election、topology epoch 重连和 checkpoint restore；Host migration 失败则安全终止；5 小时强制休息与多人暂停配额。 | STUN；TURN 仍 optional |
| **P10** | 非对称：僵尸玩家身体/生命次数/重生延迟/感染点/召唤、**每日全员答题 + 轮值选卡 + 个人感染点小卡**；**不制作新玩家 Boss 资产**，直接让 P5 的同 4 个 Boss 接入 Player Controller、多人 Boss 数值/空间/令牌预算、`bossScale` 表现分缩放与 AI 接管/重连切换。 | — |
| **P11** | 教学后台：学生/教师游戏中心、按 P-1 结论落地的作业类型模型、`game_unlock_requirements` / `game_assignment_versions` / `game_assignment_completion_status`、教师学期（按教师＋班级排他）、安全与计时策略版本、题源、临时关闭权限、班级内非对称配对场次。 | — |
| **P12** | 治理与结算：接受并标注 Host 作弊风险；数据库仍做 membership/归属/幂等/状态机校验；三套个人段位、教师授权报告、申诉/导出、删除/匿名化、撤销 SLO、日志脱敏、赛季/规则冻结；确认无高可信竞技榜单。 | — |
| **P13** | 显式 110 卡内部池 → 完整 262 卡、全部进阶武器与资产、LocalAuthority 离线练习、2–8 人/移动端/课堂灰度、Games web/API/content 独立回滚演练、`game.ningacademy.org` 切换与发布。 | Games DNS + Vercel/Supabase/R2 环境变量 |

云预算：

- 多人世界计算和主要游戏流量由 Host/peer 承担，常驻 multiplayer compute 成本为零；信令复用现有 Production Supabase。
- 第一版必须配置 STUN，TURN 保持 optional 且默认不购买。严格 NAT、学校防火墙或部分移动网络可能无法直连，UI 必须明确说明原因；以后增加 TURN 只改集中式 ICE 配置。
- Supabase 与 Vercel 是否需要升级按正式使用量、备份与商业条款在上线门禁复核，不创建第二个数据库项目。
- R2 初期可使用 10GB-month 免费存储与免费公网 egress 额度；默认关闭全量高频回放正是为了留在这个额度内。参见 [Cloudflare R2 定价](https://developers.cloudflare.com/r2/pricing/)。
- Vercel Hobby 只允许个人、非商业使用；若 NingAcademy 属于商业使用，生产发布前必须升 Pro。参见 [Vercel Hobby 条款](https://vercel.com/docs/plans/hobby)。
- 正式组合仅包含既有 Main Vercel、独立 Games Vercel、共享 Production Supabase、R2、DNS 和可选 TURN；预算告警分别按各平台实际用量设置。

---

## 6. 测试与发布门槛

### 6.1 数据库

- P-1 三份报告全部结清；所有 migrations 在全新 CI 临时 Supabase 完整重放。Production 只读 preflight 明确 Git/DB migration count、pending list、schema/ACL/FK drift 和 UNKNOWN 项；未获批准不执行 DDL/DML。
- 验证：逐函数 `SECURITY INVOKER/DEFINER`、owner、`FORCE ROW LEVEL SECURITY`、`games_api` 零表权限、`game_private` 无 USAGE、旧运行时角色零执行权限、票据双兑换竞态、答案幂等、退出撤销、作业类型分派。
- 断言：`assignables.assignable_kind` 不接受 `game`（循环锁定不可能构造）。
- P2P fixtures 覆盖 create/join、无效/过期/满房、重复 peer、2–8 容量、membership、信令 TTL/cleanup、Host election、checkpoint 单调性和旧 topology signal 清除。
- 断言：`academic_terms` 排他约束允许同教师跨班级重叠、禁止同教师同班级重叠。
- 断言：`game_assignment_versions` 的 `UPDATE`/`DELETE` 被触发器阻止；进行中对局绑定的版本内容不随教师修改而变化。
- 断言：含 `DROP COLUMN` / `DROP FUNCTION` 的 migration 必须声明已下线的合同版本。

### 6.2 安全

- CSRF、Origin、Sec-Fetch、CORS、Cookie 属性（`__Host-` 前缀、无 Domain、Strict）、同源 Games API、限速/消息大小、房间码暴力尝试、重复请求、伪造 user ID、越权教师报告。
- **房间码 ≠ 授权**：构造「持有正确房间码但不在 `assignment_targets` / 邀请 ACL 内」的账号，必须被拒绝。
- **教室共享 IP**：模拟同 IP 40 个已认证账号并发登录与开局，全部成功，零封禁，只产生告警。
- **撤销 SLO**：`revocation_latency_p95 ≤ 5s`、`p99 ≤ 15s`；分别测试 API poll、heartbeat、Host 移除和会话已撤销后的重新协商拒绝。
- **Games session**：过期、撤销、伪造、重放 ticket 均拒绝；普通 Supabase JWT、Authorization header、query/localStorage token 均不能替代 Games session。
- **日志脱敏**：样本日志 grep `__Host-` / `ticket=` / `answer` / `Bearer ` 零命中。
- **听力泄露**：同一词跨两次 `content_release` 的对象 key 必须不同；直接访问 R2 音频 bucket 必须 403；过期签名 URL 必须 403；同一 `question_instance_id` 第 4 次音频请求触发标记。

### 6.3 游戏核心

- 固定种子事件回放、伤害顺序、卡牌硬上限、被动总数上限、收益递减合并、proc/CPU 预算与确定性丢弃顺序（Host 与 LocalAuthority 一致）。
- Boss 共享预算、**大招/控制令牌同 tick 争用的确定性胜者**、最小间距推开、复活点禁入。
- **Boss 资产独立性**：4 个 `boss_asset_id` 不得引用其他 Boss 的 Skeleton、动画文件、Mesh、材质、贴图或可破坏部件；构建时做依赖图断言。
- **Boss 地图解耦**：4 个 Boss × 4 个生态地图全部完成 AI 生成 smoke test，不允许用 biome 过滤 Boss 池。
- **Boss 双控制模式**：4 个 Boss 分别以 AIController 与 PlayerController 跑通移动、普攻、技能、受击、阶段破坏、死亡；断线 AI 接管与重连恢复 Player 时 `boss_asset_id` 必须保持不变。
- 空合法卡池、死亡保护优先级、`S159` 补偿与窗口剔除、`S160` 团灭、watchdog、五小时恢复。
- **`bossScale`**：故意送死路径必须得到 0.7，正常发挥路径必须得到 1.0。
- **暂停**：暂停期间题面隐藏且计时冻结；恢复后必须换新题且倒计时重置；Boss 大招前摇 1.5 秒内的暂停请求必须被拒绝；配额耗尽后请求必须被拒绝。
- **答题保护**：窗口内普通敌人伤害必须为 10%、Boss 为 50%；`question_window_closed_tick` 后下一 tick 必须恢复 100%（逐 tick 断言，无过渡帧）。
- **听力静音**：播放期间 `world` 总线增益必须为 0 且无新一次性音效实例；结束 200ms 内恢复；被抑制音效不补播。

### 6.4 网络

- Playwright 至少两个 browser context 完成 SDP offer/answer、ICE、可靠/实时 DataChannel、input → Host simulation → snapshot → peer；验证不存在 peer↔peer Full Mesh。
- 0/75/150/200ms RTT、jitter、2% 丢包与旧 snapshot 积压；预测关闭时 peer 必须与 Host 一致；150ms 下弱点/击杀仅在 Host 确认后播放。
- 近战在 200ms 下不得出现「peer 本地结算伤害、Host 拒绝」；本地只能预测表现。
- 覆盖 peer disconnect/reconnect、Host disconnect/election、7 条连接的 8 人房、checkpoint restore、migration 失败安全终止、STUN-only 失败提示和 optional TURN 配置注入。
- `layout_hash` 不匹配必须拒绝进入，不得降级进入。

### 6.5 合作与救援

- 两个客户端同时抢救援锁只能一人成功。
- **三条释放路径分别验证**：断线/死亡 → p95 ≤500ms；无活动 → 8 秒 ±0.5 秒；总占用 → 45 秒 × accommodation 强制释放。
- 1.5×/2× accommodation 不允许无限占锁；且必须验证每题节奏在 1×/1.5×/2× 下比例一致。
- **2 人房**：唯一队友自动持锁、无投票；唯一队友倒地 → 直接永久死亡判定。
- **3–8 人房**：投票接管需 2/3 票且严格多数；持有者放弃 → 立即转移。
- 救援次数上限达成后再次倒地必须直接进入永久死亡判定。
- 地狱 Day 1 与 Day 16 的实际每题秒数必须分别为 12 秒（1×），不得出现 rev1 那样的 5 秒 / 1.7 秒。

### 6.6 内容

- 262 个稳定 ID 连续唯一、全部前置存在且无环。
- **概率表每行合计 = 100**（CI 断言）。
- 每个模式/Day/生态/职业都有合法三选一或明确空池终止；所有生成卡声明配额、奖励、阶段和实体上限。
- 每张卡的状态必须能装进统一 `card_state`（4×i32 + 4×f32）；超出即构建失败。
- 非对称每 Day 全员答题：验证 50% 阈值的向上取整、个人扣分不影响他人、单僵尸退化路径。

### 6.7 无血与可访问性

- 构建物不得含血液、喷溅、肢解、肉块或持久尸体素材。
- 四生态、所有武器、50 怪连爆和 Boss 演出进行逐帧闪烁分析，滚动 1 秒 ≤2 次，并人工复核。
- 减少动态效果后仍保留轮廓、字幕、图标和声音提示。
- 听力静音期间必须仍有完整视觉信息（字幕、命中提示、弱点轮廓）。

### 6.8 性能

- Iris Xe 720p 压力场景总帧 p95 ≤33.3ms，结晶效果增量 CPU ≤2ms / GPU ≤3ms。
- GTX1650 1080p 总帧 p95 ≤16.7ms。
- 30 分钟 VFX soak 后 heap 漂移 ≤5MB。
- **proc 预算**：262 卡满载、24 常驻被动、50 怪同屏场景下，卡牌系统每 tick CPU ≤3ms；超预算时丢弃顺序确定且不产生表现闪烁。

### 6.9 负载与存储

- 目标 30 并发参与者；45/60/90 人只压测 Supabase 短时信令与 Games API。游戏负载按 2/4/8 人房在 Host 浏览器分别 soak；8 人是正式容量，Host 必须只有 7 条 peer connection。
- **R2 用量**：8 小时 60 CCU 压测后，`checkpoints` + `replays` 总占用必须 ≤2GB，并验证 lifecycle 到期删除生效。
- 验证 `ning-game-checkpoints` / `replays` / `anticheat` 三个 bucket 无自定义域、无公开策略（CI 断言 + 手工 curl）。

### 6.10 手机

Chrome Android、Safari iOS、触控、横屏安全区、软键盘、后台切换、发热、内存和 180 秒重连全量通过。暂停 UI 与听力静音在移动端单独验证（含来电/切后台打断音频的恢复）。

### 6.11 发布

- 连续 7 天无 P0 事故。
- Games Vercel、Supabase 信令或 P2P 连接故障均不得影响 NingAcademy 普通作业；单人 LocalAuthority 在无需保存结果时不依赖多人服务。
- **Games web/API 与 content 可独立回滚并完成演练；数据库只前滚，演练一次 forward-fix 流程。**
- 教师小班灰度通过后才开放完整 V1。
