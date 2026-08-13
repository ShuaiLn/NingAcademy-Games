# Locked product rules

This file records product decisions that implementation and content validation
must treat as invariants. A change requires a versioned ruleset rather than an
untracked code edit.

## Identity, modes, and results

- The managed game is entered through a NingAcademy one-time ticket. It never
  accepts a Supabase JWT as a second game identity path.
- Online solo, 2–4 player co-op, assignments, and asymmetric matches use the
  authoritative server. `LocalAuthority` is unverified personal practice only.
- There is no all-player leaderboard. The product shows each player only their
  own current tier, progress, history, and transparent promotion criteria.
- Survivor and crystal-faction ranks are separate. Crystal rank uses wins plus
  graded-answer accuracy. A wrong answer lowers accuracy and may lower rank.
- Results distinguish English-to-Chinese, Chinese-to-English, listening
  spelling, and mathematics, including question tier and accessibility mode.
- A listening question completed through a text accommodation is tagged
  `text_alternative` and does not count as listening accuracy.
- Game results are engagement and practice indicators, not academic-level
  claims.

## Learning and card decisions

- Survivor players do not receive a free daily card. Each player earns a card
  decision after every ten eligible kills at first; later rulesets increase the
  required kill progress by Day to prevent exhausting the catalog early.
- Card order is select first, answer second. A correct answer applies the card.
  A wrong or timed-out in-game answer voids the card, immediately shows the
  correct answer plus a short explanation, and deals 10 unmitigated damage down
  to a minimum of 1 HP. It never kills the player directly and grants no enemy
  buff. Letting card selection expire only loses the opportunity.
- The card/question overlay lowers incoming damage to 10% in multiplayer. It
  releases Pointer Lock and is safe for IME composition. Solo authoritative
  play may pause its game clock; multiplayer freezes only that player's
  decision state.
- The first survivor profession is unlocked without a question. Selecting an
  already unlocked non-default profession requires one untimed pre-game
  question; first-time profession unlocks require progressively more untimed
  questions. These are separate from timed in-game questions.
- Assignment question counts do not depend only on personal kills. Fixed Day
  learning nodes or team learning progress ensure every assigned player can
  complete the required number.
- A mixed-assignment room gives every player their own frozen question snapshot
  and accommodation policy. When all assigned work is complete, the room owner
  may select an allowed personal or teacher-selected set.
- Correct answers never travel in client question payloads. Formal audio is
  pre-generated and frozen; practice may use browser speech synthesis. The game
  has no microphone, recording upload, speech recognition, or voice grading.
- Attempts are saved immediately and idempotently. Final settlement is not the
  only persistence boundary.

## Crystal faction and asymmetric play

- The code/catalog prefix remains `zombie`; player-facing enemies are
  crystalline psionic husks (`结晶体` / `Thrall`), never flesh corpses.
- In PvE, the AI crystal faction randomly picks one shared faction card at the
  start of every Day and succeeds automatically.
- In asymmetric play, one active crystal player is selected randomly at each
  Day start to choose one of three shared faction cards and answer. Its effect
  applies to every mob.
- A player-controlled crystal body starts with +5% HP, +5% damage, and +5%
  speed. Total player-body bonuses remain hard-capped and are ruleset data.
- A destroyed player body is replaced immediately while its daily life quota
  remains. Repeated deaths yield sharply reduced or zero progression/reward so
  free bodies cannot drain survivor ammunition without cost.
- The player directly controls a crystal body. Profession abilities may summon
  units; otherwise the system maintains the required mob quota. Summoning has a
  server-owned cooldown, placement/visibility rules, per-owner quota, and global
  entity cap.
- Infection points earned from damage use a per-time cap, repeated-opponent
  decay, and anomaly detection. Healing/infection loops cannot farm rank.
- On the Boss transition, player-body respawns stop. Remaining bodies are
  converted or cleared, and eligible crystal players control Boss bodies under
  one shared Boss budget. Simultaneous major skills are rate-limited.
- If a crystal player leaves during the Boss phase, AI takes control. A survivor
  voluntary quit is not credited to crystal-player records. If an asymmetric
  match falls back to PvE, its result remains labeled as an asymmetric match
  with fallback metadata; it is never silently reclassified.

## Day, Boss, rescue, and watchdogs

- PvE AI Bosses and player-controlled Bosses are mutually exclusive by mode.
- Boss health, action economy, summons, and abilities draw from a whole-team
  shared budget that is divided across concurrent Boss bodies.
- The next Day starts only after the Boss is dead, all of its weakened summons
  are cleared, and every downed survivor is either successfully rescued or
  resolved. Boss summons do not count as ordinary eligible kills.
- Every phase has a watchdog, unreachable-enemy migration/cleanup, and an
  operator termination path. Endless mode cannot stall forever.
- Rescue claims are leases with inactivity expiry. Death, disconnect, leave,
  cancellation, or approved teammate takeover releases the claim immediately.
- Each downed player has an independent rescue timer and lock. A rescuer cannot
  move or attack and is not invulnerable. A wrong rescue answer resets the
  correct streak without dealing damage.
- On successful rescue, the server chooses a nearby validated navigation point,
  restores 30% HP, gives 3 seconds of non-attacking/no-collision protection,
  and preserves the player's weapons and applied cards.
- Combat difficulty controls enemies, resources, and total rescue window.
  Learning difficulty independently controls question tier, per-question time,
  and required rescue streak.
- Card-answer time by learning difficulty is 30/20/15 seconds. Rescue-question
  time is 25/18/12 seconds. Rescue total window starts at 45/35/25 seconds and
  decreases every five Days to floors of 25/20/15 seconds.
- Rescue streak starts at 2/3/4 by learning difficulty, adds one every five
  Days, and caps at 5/6/7.

## Progression, sessions, and content

- Every stacking card has a hard cap, diminishing-return or replacement rule,
  and a full-stack fallback. Mechanic-card slots are finite.
- Content is versioned and data-driven. A card that needs engine behavior uses
  an explicit allowlisted handler and cannot execute arbitrary script.
- Weapon slots, ammunition, replacement, pickup/drop/share rules, supplies,
  upgrade prerequisites, Boss rotations, and biome variants are ruleset data.
- Maps are selectable difficulty presets: house is easy, grassland normal,
  desert hard, and hell the highest difficulty. Competitive results always
  record the chosen map and both difficulty axes.
- Every five hours of continuous play, the server checkpoints the session,
  shows “休息一下吧，已经玩很久了 / Time for a break”, and forces a clean
  exit. Authentication, rest lease, reconnect, and server-health clocks never
  pause for cinematics.
- Reconnect windows are configurable in the 2–5 minute range. Periodic
  checkpoints and server-failure recovery prevent losing an entire Day. A
  ruleset update must migrate or grant a versioned grace window to live saves.

## Presentation and accessibility

- There is no blood, red-liquid decal, gore, dismemberment, or persistent body
  chunk. Hits crack a crystalline shell; kills overload the core, shatter into
  pooled fragments, then dissolve into light dust. Grassland uses spores, house
  violet crystal, desert sand, and hell ember/ash, with shape and sound cues in
  addition to color.
- Hit stop and camera shake are local presentation only. They never pause input,
  prediction, networking, authoritative ticks, questions, rescue, or wall-clock
  leases. The one-second hit-stop budget is at most 80 ms.
- A global flash governor coordinates all effects. The product permits at most
  two high-contrast flashes in any rolling second, no full-screen white flash,
  and no saturated-red flash.
- Flash, shards, hit stop, shake, screecher distortion, slow motion, haptics,
  and volumes have separate controls. Operating-system reduced-motion disables
  flashing, hit stop, shake, distortion, and time stretch and replaces them
  with persistent outline, text/icon, and audio cues.
- Teachers may lower classroom effect ceilings. Students may always lower them
  further; nobody may override the operating-system safety preference upward.
