# Project status — rev2.1 WebRTC gameplay

Date: 2026-08-21

## Current assessment

Against the complete playable FPS V1 scope, the repository is approximately
31% complete by functional weight. The Host-P2P foundation, deterministic P6
greybox world, networked enemy collection and a minimum authoritative Wave
loop now exist; most content systems (cards, full Day/supply, production map
assets, Bosses, loot, rescue and questions) are not runtime gameplay yet.

## Implemented in code

- One Next.js/Vercel application owns Games Web, `/redeem`, session status,
  ICE configuration and same-origin signaling APIs.
- Ticket exchange preserves body-only transport, exact Origin/Fetch Metadata,
  atomic redemption, expiry/replay rejection and strict Host-only cookies.
- Multiplayer uses a Host↔peer WebRTC star with separate reliable control and
  unordered/no-retransmit realtime channels; capacity is 2–8.
- Host simulation runs at 30Hz, sends snapshots at about 15Hz, persists a
  five-second checkpoint, and binds peer input identity to the RTC channel.
- Reconnect membership, deterministic Host election, topology epochs and
  checkpoint recovery remain in place. Permanent room leave now also removes
  the player's combat entity and history representation; temporary disconnects
  inside the reconnect window do not.
- The running multiplayer room enters a real Babylon scene: local FP rifle,
  remote TP survivors/rifles, multiple Thralls, movement, firing, reload,
  authoritative HP/damage/ammo, death/respawn and enemy spawn/despawn are
  connected to the Host world.
- Local movement prediction uses the same movement integrator as Host.
  Reconciliation discards acknowledged inputs and replays pending input;
  remote survivors and every enemy interpolate behind 15Hz snapshots. Damage,
  hits, HP, ammunition, enemy AI and respawns are never predicted by peers.
- P6 now has a deterministic 5×5 canonical greybox contract: shared seed,
  generator/collision/asset versions, FNV-1a layout hash, compact module
  placements, eight player spawn points, four enemy spawn zones, navigation
  graph/bounds, collision volumes and reserved supply/Boss areas. Meshes are
  reconstructed locally; no runtime geometry is sent over WebRTC.
- Host movement and local prediction share the same map-boundary/collision
  integrator. Peers reject incompatible layout hashes instead of entering a
  divergent world, and the same metadata is carried in snapshots/checkpoints.
- Enemies are a stable-`entityId` collection. Spawn, AI target selection,
  movement, attacks, HP, death and tombstoned despawn are Host-only; peers only
  reconstruct and present snapshot state, animations and hit/death cues.
- A minimum extensible Wave Director owns wave number/kind/phase/revision,
  remaining count, deterministic spawn seed/schedule/selection and break timer.
  Wave 1 spawns three enemies; later waves increase count and HP. A wave cannot
  complete while its authoritative enemy collection still contains entities.
- Snapshot validation retains room/revision/topology-epoch checks and adds map,
  enemy and wave revisions. Late/stale collection state cannot resurrect a
  tombstoned enemy; checkpoint restore validates and reconstructs the complete
  current greybox/enemy/wave state.
- The P1 adversarial gate has automated coverage for authority overwrite,
  teleport fields, forged kills, over-rate fire and empty-ammo fire.
- Single-player practice remains completely local and has its own real Babylon
  scene, one rifle, one Thrall, local questions/cards and safety controls.

## Verification at this status

- Boundary check, TypeScript, ESLint and Next.js 16.3 production build pass.
- 25 Vitest files / 122 tests pass.
- Static model verification passes for 70 GLBs / 65 runtime assets.
- The eight-browser-context Host→7 peers Playwright topology test passes and
  asserts all seven peers receive the same map hash, wave state and enemy ids.
- Local Playwright browser smoke confirms a 200 home page, no framework error
  overlay or console/page error, and a visible Babylon 9.21/WebGL2 practice
  scene with loaded Thrall, attachment, FP rifle and effect GLBs. The
  unauthenticated multiplayer gate remains expected.

## Largest remaining gameplay gaps

- The deterministic map is a functional greybox, not the production P6 asset
  set. Four biome module libraries, doors/events, baked navmesh/collision asset
  pipeline, safe-respawn semantics and device/resource-budget validation remain.
- The Wave Director is deliberately smaller than the rev2.1 Day system: there
  is no quota cleanup/Boss transition/supply phase/zombie card integration.
- No loot/pickups/inventory, full weapon families, card runtime, complete Day/
  supply state machine, Boss AI/phases/breakable parts, question gameplay,
  downed/revive/rescue or production completion reporting.
- The enemy collection proves multi-entity authority and replication but is
  not yet the mass-enemy solution: pooling/instancing, delta or interest-based
  snapshots, richer navigation and target/path watchdogs still need work.
- A reconnecting peer channel receives the latest snapshot and Host checkpoint
  restore now carries map/enemies/wave, but true late-join admission and full
  reconnect/Host-migration gameplay restoration remain incomplete and still
  need authenticated network E2E, failure handling and migration-version tests.
- Mobile controls, learning/world audio buses, browser/device performance
  budgets, latency/jitter suites and authenticated gameplay E2E remain open.
- `docs/locked-product-rules.md` still contains rev1 rescue/Day wording that
  conflicts with the rev2.1 implementation plan. Day/rescue work must use the
  plan as authority and align that document before encoding those rules.

## Production dependencies requiring the operator

- Create a restricted Production PostgreSQL LOGIN able only to `SET ROLE
  games_api`, then place its URL in the Games Vercel server environment.
- Create/bind the independent Games Vercel project to this repository.
- Add `game.ningacademy.org` DNS and exact Production environment values.
- TURN remains optional for V1; STUN is required.

Production migration history was recorded as 30/30 in the 2026-08-21 todo
audit. This gameplay work performed no Production DDL/DML, migration, deploy or
data mutation, and did not modify the NingAcademy main-site repository. The
previous staging verification is historical evidence, not a continuing
deployment prerequisite.
