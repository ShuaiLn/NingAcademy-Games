# NingAcademy Game

Browser-based 3D FPS learning game for NingAcademy. The repository is an npm
monorepo with an authoritative Colyseus server, a Next.js/Babylon.js client,
and pure TypeScript gameplay packages.

## Repository layout

- `apps/web` - browser client and presentation layer
- `apps/server` - authoritative Colyseus server
- `packages/game-core` - deterministic-by-seed gameplay rules with no browser or server framework dependencies
- `packages/protocol` - versioned network commands and events
- `packages/authority` - `RemoteAuthority` and `LocalAuthority` contracts
- `packages/content` - versioned, validated data-driven content
- `packages/testkit` - shared fixtures, bots, and network test helpers

## Safety

The committed codebase never contains Supabase secrets, service-role keys,
launch tickets, or setup tokens. Copy `.env.example` into app-specific local
environment files and use staging credentials only during development.

## Commands

Use Node.js 22.13 or newer (or Node.js 24 LTS). The lint dependency graph does
not support Node.js 22.12.

```bash
npm install
npm run dev:web
npm run dev:server
npm run typecheck
npm test
```

## Local playable slice

Run `npm run dev:web`, open `http://localhost:3000`, and use the explicitly
unverified LocalAuthority practice arena:

1. Pick Vanguard to enter immediately, or another profession to exercise the
   untimed IME-safe role gate.
2. Click the arena to capture the pointer. Move with WASD, aim with the mouse,
   fire with the primary button, and reload with R.
3. The crystalline Thrall chases and attacks, dies after two hits, and respawns.
4. The tenth kill releases pointer lock and freezes the local simulation. Pick
   one of three cards; answer `42` to exercise success, or submit another answer
   to see immediate correction and nonlethal 10-HP damage.
5. Enable reduced motion and confirm flashes/shards are replaced by a static
   outline cue.

This slice intentionally ships mock answers in the browser. It never writes an
assignment, learning record, or personal rank. Verified play remains fail-closed
until the main-site launch ticket and restricted staging database RPCs are
connected.

The `ningacademy-staging` API is available but its database schema is currently
empty. Database work must use an explicit `SUPABASE_STAGING_DATABASE_URL`; never
run a linked Supabase CLI command from the tutoring repository because that
repository remains linked to the main project.

The Phase 0 integration target is the smallest complete NingAcademy flow:
main-site login, one-time launch ticket, authoritative room, one server-graded
question, idempotent settlement, and an authorized teacher result.
