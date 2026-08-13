# NingAcademy main-site integration contract

This document is the cross-repository contract between the existing NingAcademy
site (`tutoring`) and the standalone game. Database migrations remain owned by
the main-site repository. The game repository must never push migrations to the
production database.

## Connection status

| Dependency | Current state | Required action |
| --- | --- | --- |
| Local NingAcademy source | Available | Preserve the existing uncommitted navigation and logo work. |
| Production Supabase | Linked from the main repository | Do not use for game development or migration experiments. |
| Supabase staging API | Connected and verified as a different project | Auth and secret-key API health pass; its database schema is currently empty. |
| Supabase staging database | **Connection pending** | Add `SUPABASE_STAGING_DATABASE_URL` to the ignored game `.env.local`, replay all main-site migrations using explicit `--db-url`, then apply the audited game migration. Never use `--linked`. |
| Main-site Vercel | Existing deployment | Add preview/production variables only when the launch action is ready. |
| Colyseus Cloud | Not connected | Required for the Phase 0 remote room and ticket exchange. |

No Anthropic or Claude connection is part of this contract.

Before any database command, run `npm run check:staging-target`. A migration
command must be executed from the tutoring repository with the verified URI
passed explicitly through `--db-url`; `--linked` is prohibited because the
tutoring CLI link still identifies the main project.

## Phase 0 vertical slice

The first integration is intentionally thin but complete:

1. An authenticated, ready student requests game access from the main site.
2. The main-site server validates the student's current profile and eligibility.
3. The database creates a 256-bit, one-time, 60-second launch ticket and stores
   only its hash.
4. A no-store page auto-POSTs the ticket to the game server. The ticket never
   appears in a URL or referrer.
5. The game server atomically redeems the ticket through its restricted
   database role and creates an opaque, revocable game session.
6. The student enters an authoritative empty room and receives one server-owned
   question instance without the answer.
7. The game server grades one idempotent answer, creates one immutable attempt,
   and finalizes one game attempt.
8. The student can read their own result and the owning teacher can read the
   authorized result through narrow DTO/RPC contracts.
9. Main-site logout, password change, account disable, assignment revocation,
   and unenrollment invoke or trigger `revoke_game_sessions_v1`; every room
   recheck observes the revoked database session.

The vertical slice is not complete until a replayed ticket fails, a duplicated
answer request returns the original result, and logout revokes the game session.

## Database ownership

The main-site migration adds:

- `assignment_kind` to `public.assignments`, defaulting to `plain`;
- one-to-one `public.game_assignment_configs`, reusing
  `public.assignment_targets`;
- teacher-managed academic terms and immutable safety/timing policy versions;
- `game` tables for sessions, players, immutable attempts, question attempts,
  and personal rank snapshots;
- `game_private` tables for launch-ticket hashes, opaque session hashes,
  frozen answers, idempotency keys, revocation outbox rows, and audit events.

It does **not** create a second assignment system and does not write game results
to `public.submissions`.

The canonical prerequisite helper must preserve the existing completion rules
for plain assignments, pronunciation tasks, and both vocabulary practice
engines. The game server may call the helper but may not reimplement that math.

## Server database identity

The authoritative server uses a dedicated Postgres login with:

- `NOINHERIT` and `NOBYPASSRLS`;
- no table privileges;
- `EXECUTE` only on a versioned RPC allowlist;
- a password stored only in the Colyseus deployment environment.

The server must not receive a Supabase publishable key, secret key, service-role
key, user refresh token, or NingAcademy password. Any `SECURITY DEFINER`
function is owned by a non-login role, uses an empty search path, and fully
qualifies every database object.

## Browser and cookie boundary

- Main-site launch is POST-only.
- The opaque game session cookie is set by the authoritative game-server host
  with `Domain` omitted and `Secure; HttpOnly; SameSite=Strict; Path=/`.
- The game web origin calls the game server with credentials included.
- The server validates exact origins, CSRF data, `Sec-Fetch-*` headers, message
  sizes, input rates, and room-code attempt rates.
- The game never accepts a Supabase JWT as an alternate identity path.

## Required deployment variables

Variable names are documented here; values must not be committed or pasted into
issues or chat.

### Main-site Vercel

- `GAME_LAUNCH_EXCHANGE_URL`
- `GAME_WEB_ORIGIN`

### Game server / Colyseus Cloud

- `SUPABASE_STAGING_DATABASE_URL` or the production restricted-role equivalent
- `GAME_WEB_ORIGIN`
- `NINGACADEMY_MAIN_ORIGIN`
- `GAME_SESSION_COOKIE_NAME`
- `GAME_SERVER_REGION`

### Game web / Vercel

- `NEXT_PUBLIC_GAME_SERVER_URL`
- `NEXT_PUBLIC_ASSET_BASE_URL`
- `NEXT_PUBLIC_RELEASE_CHANNEL`

## Immediate escalation rule

Work stops before any production mutation if staging has not replayed every
main-site migration successfully. Any request for production Supabase, Vercel,
DNS, or Colyseus access is reported to the user before the dependent operation;
secrets are always entered through the owning service's environment UI.
