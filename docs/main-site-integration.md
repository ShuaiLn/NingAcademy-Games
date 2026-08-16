# NingAcademy main-site integration

This document is the cross-repository Production contract. Database migrations
are owned by the NingAcademy main-site repository. Games never deploys schema
changes and never exposes a Supabase credential to the browser.

## Formal deployment

| Component | Production target | Responsibility |
| --- | --- | --- |
| Main site | `https://ningacademy.org` | Supabase Auth, assignment/unlock checks, one-time ticket issue |
| Games | `https://game.ningacademy.org` | Next.js UI, `/redeem`, Games session, P2P/signaling Route Handlers |
| Supabase | existing NingAcademy Production project | identity, game records, P2P rooms/members/signals/checkpoints |
| Browser Host | one player browser | authoritative game simulation, max 7 peer connections |
| STUN | centrally configured | ICE discovery |
| TURN | optional, not required for V1 | relay only when later configured |

There is no second Games Supabase project, no future staging Supabase
dependency, and no separate play/server domain. The earlier staging report in
the main-site repository is retained only as historical audit evidence.

## Launch sequence

1. A student signs in on the main site and opens a game assignment.
2. `get_game_access_status()` derives identity from `auth.uid()` and checks the
   current immutable Scheme B requirement version.
3. `issue_game_launch_ticket_v1()` returns a 60-second opaque ticket; only its
   hash is stored.
4. The main site puts the raw ticket in an HttpOnly, Strict transition cookie
   scoped to `/student/game/launch`.
5. The transition Route Handler clears that cookie and returns CSP-locked HTML
   that auto-POSTs exactly one `ticket` form field to
   `https://game.ningacademy.org/redeem`. No URL/query/history token exists.
6. Games validates exact Origin and Fetch Metadata, atomically redeems the
   ticket, rechecks eligibility, and sets `__Host-ning_game_session` with
   Secure, HttpOnly, SameSite=Strict, Path=/ and no Domain.
7. Games redirects to `/`. The browser can now create/join a P2P room through
   same-origin APIs. No second login is shown.

Forged, expired, replayed or revoked tickets fail closed. Authorization headers,
client user ids, Supabase JWTs and query tokens are never identity fallbacks.

## Games API database identity

Games Vercel uses a server-only PostgreSQL/pooler LOGIN created by an operator.
The LOGIN has no direct object grants and may only `SET ROLE games_api`.
`games_api` is NOLOGIN/NOINHERIT/NOBYPASSRLS, has schema usage only on `game`,
zero table privileges, and execute only on the catalog-defined ticket/session
and P2P RPC allowlist.

Required server-only values:

- `GAME_DATABASE_URL`
- `GAME_DATABASE_ROLE=games_api`
- `GAME_WEB_ORIGIN=https://game.ningacademy.org`
- `NINGACADEMY_MAIN_ORIGIN=https://ningacademy.org`
- `GAME_STUN_URLS`

The browser receives only authenticated ICE configuration and room-safe public
membership fields. It never receives the database URL/password or a Supabase
secret/service key.

## Signaling and reconnect

`game_private.p2p_rooms`, `p2p_members` and `p2p_signals` are unexposed tables.
The API supports create, join, poll/heartbeat, ready/start, signal, checkpoint,
leave/end and cleanup via `game.*_v1` functions. Room codes use six unambiguous
characters. Rooms expire after two hours; signals expire after two minutes and
are cleanup-indexed.

Every signaling exchange validates the opaque Games session and active room
membership. Signals may connect only Host↔peer for the current topology epoch,
which structurally prevents full mesh. A disconnected member retains a
three-minute reconnect window. When Host disappears, Supabase elects the oldest
connected member deterministically, increments the topology epoch and clears old
signals; browsers then rebuild the star and the new Host restores the latest
checkpoint.

## Revocation and rollout

Profile disable/password change, assignment unpublish/archive, target changes,
unenrollment and unlock-version replacement revoke tickets/sessions. Main-site
logout/password change also calls `revoke_game_sessions_v1`. Every room API
revalidates the Games session, so revocation fails the next heartbeat/API call.

Production rollout order:

1. Complete and review a Production read-only migration/schema/ACL/FK audit.
2. Obtain explicit approval and apply the exact pending main-site migrations in
   filename order.
3. Create the restricted Games API LOGIN as a member able to `SET ROLE
   games_api`; do not use an owner credential.
4. Deploy the independent NingAcademy-Games Vercel project.
5. Configure `game.ningacademy.org`, environment secrets and main-site
   `GAME_LAUNCH_EXCHANGE_URL=https://game.ningacademy.org/redeem`.
6. Run ticket/session, 2–8 player WebRTC, reconnect/Host migration, revocation
   and result smoke tests.

Steps that write Production, create external credentials, set secrets or change
DNS require the user's explicit action/authorization.
