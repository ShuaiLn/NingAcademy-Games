# NingAcademy Games

NingAcademy 的独立浏览器 3D FPS 学习游戏。正式架构是：

`Babylon.js + WebRTC RTCDataChannel + Host-authoritative P2P + Supabase signaling + Vercel`

多人房支持 2–8 人，使用星型拓扑：创建者为 Host，最多维护 7 条
`RTCPeerConnection`。Host 浏览器运行敌人/Boss、世界、伤害、掉落、Day、
卡牌、复活与结果模拟；其他 peer 只发送输入/意图。产品接受 Host 作弊风险，
但数据库身份、作业资格、房间成员和结果写入仍由受限 RPC 校验。

## Repository layout

- `apps/web` — 唯一部署单元：Next.js 16 + Babylon.js 客户端，以及运行在
  `game.ningacademy.org` 的 Vercel Route Handlers。
- `packages/game-core` — 与浏览器/网络无关的确定性规则与 reducer。
- `packages/protocol` — 版本化命令、事件、可靠控制包和非可靠实时包合同。
- `packages/authority` — `LocalAuthority`、transport-neutral
  `RemoteAuthority`，以及 Host 浏览器的 `HostP2PAuthorityRuntime`。
- `packages/content` — Zod 校验的卡牌/内容目录。
- `packages/testkit` — 公共 fixtures。
- `docs` — 产品不变量、主站集成合同与当前状态。

本仓库不拥有数据库迁移。所有 Supabase 迁移均在相邻的 NingAcademy 主站
仓库中维护、审计并部署。

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev:web
```

未配置数据库时，本地单人练习仍可运行；多人和 `/redeem` 会 fail closed。
单人模式完全使用 `LocalAuthority`，不会创建房间、信令或 WebRTC 连接。

常用检查：

```powershell
npm run check:boundaries
npm run check:models
npm run typecheck
npm run lint
npm test
npm run build
npm run test:p2p-e2e
```

`test:p2p-e2e` 使用 8 个 Playwright browser context 验证 Host→7 peers 星形连接、
可靠控制 channel 与 `ordered=false/maxRetransmits=0` 实时 channel。它需要已安装
Chromium，但不需要 Supabase。

## Identity and API boundary

唯一身份流程：

1. 学生在 `ningacademy.org` 登录并通过 Scheme B 作业解锁检查。
2. 主站签发 60 秒、一次性的 launch ticket。
3. 主站 transition route 以 POST body 提交 ticket 到
   `https://game.ningacademy.org/redeem`；ticket 不进入 URL/history。
4. Games Vercel 原子兑换 ticket，设置
   `__Host-ning_game_session`（Secure、HttpOnly、SameSite=Strict、Path=/、无
   Domain），再 303 到 Games Web。
5. Create/Join/signaling Route Handlers 只读取该 cookie，并通过受限
   `games_api` 数据库角色调用白名单 RPC。

禁止 Supabase JWT、客户端 `userId`、query token、localStorage token、
Authorization fallback 或第二套登录。浏览器不会获得数据库 URL、数据库密码、
Supabase secret/service key。

## WebRTC and signaling

- Supabase 表：`game_private.p2p_rooms`、`p2p_members`、`p2p_signals`。
- Room Code：6 位无歧义字符，唯一约束并限制撞库面。
- 信令：offer、answer、ICE；单条最大 64 KiB、2 分钟 TTL、每次轮询清理。
- 心跳：约 750 ms poll；12 秒未出现视为断连，成员保留 180 秒重连窗口。
- Host migration：按 `joined_at, member_id` 确定性选举；增加 topology epoch、
  清空旧信令、重建星型连接，并从最近 Host checkpoint 恢复。
- 可靠 channel：房间控制、命令结果、事件、答题、复活与最终结果。
- 非可靠 channel：高频 snapshot/input，`ordered=false`、`maxRetransmits=0`。
- Host 固定步进模拟为 30Hz，权威 snapshot 上限约 15Hz；peer 的实时 input 会按
  channel 绑定的 member identity 进入 Host reducer，不能携带权威身份或 world state。
- STUN：Production 必需且由 `GAME_STUN_URLS` 集中配置。
- TURN：接口已预留；`GAME_TURN_*` 未设置时完全可选。直连失败会向用户明确说明
  NAT/防火墙限制，不会静默失败。

Supabase 只做身份/信令/持久化，不转发 RTCDataChannel 游戏流量，也不运行世界
模拟。

## Production environment

Games 是独立 GitHub/Vercel 项目，正式域名只有 `game.ningacademy.org`；主站为
`ningacademy.org`。两个项目可以属于同一 Vercel Team，但不可绑定到同一 Vercel
Project。

必须设置的 server-only 值见 `.env.example`：

- `GAME_DATABASE_URL` — 专用最小权限 LOGIN；不得使用 postgres/owner。
- `GAME_DATABASE_ROLE=games_api` — 每个事务执行 `SET LOCAL ROLE games_api`。
- `GAME_WEB_ORIGIN=https://game.ningacademy.org`
- `NINGACADEMY_MAIN_ORIGIN=https://ningacademy.org`
- `GAME_STUN_URLS=...`

可选 TURN 值为 `GAME_TURN_URLS`、`GAME_TURN_USERNAME`、
`GAME_TURN_CREDENTIAL`。这些配置由受 Games session 保护的 `/api/p2p/ice`
返回；数据库 secret 永不返回浏览器。

Production Supabase migration/DDL/DML 只能从主站仓库执行，并且必须先完成新的
read-only preflight、列出 exact pending migrations，再取得明确授权。
