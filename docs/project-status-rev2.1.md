# Project status — rev2.1 WebRTC convergence

Date: 2026-08-15

## Implemented in code

- Games Git remote points to `ShuaiLn/NingAcademy-Games`.
- One Next.js/Vercel deployment owns Games Web, `/redeem`, session status, ICE
  config and same-origin signaling APIs.
- Ticket exchange preserves body-only, exact Origin/Fetch Metadata, atomic
  redemption, expiry/replay rejection and strict Host-only cookie behavior.
- Browser multiplayer uses a Host↔peer WebRTC star with separate reliable and
  unordered/no-retransmit channels; capacity is 2–8.
- Supabase migration draft defines room codes, membership, signaling TTL,
  cleanup, reconnect, deterministic Host election, topology epochs and Host
  checkpoints under unexposed schemas.
- `games_api` is a zero-table-grant runtime role; the retired runtime role loses
  schema usage and function execution.
- Single player remains completely local.
- Host runtime fixed-step simulation runs at 30Hz, sends snapshots at about
  15Hz, persists the latest 5-second checkpoint, and binds peer inputs to the
  RTC channel's signaling member id.
- Unit/type coverage and an eight-browser-context Host→7 peers WebRTC
  Playwright test exist.

## Production blockers requiring the user/operator

- Review the Production read-only preflight and authorize the exact pending
  migration sequence. No Production DDL/DML has been executed.
- Create a restricted Production PostgreSQL LOGIN able only to `SET ROLE
  games_api`, then place its URL in the Games Vercel server environment.
- Create/bind the independent Games Vercel project to this repository.
- Add `game.ningacademy.org` DNS and exact Production environment values.
- Optionally add TURN later. V1 requires STUN but intentionally does not require
  purchasing or deploying TURN.

The previous staging verification remains in the main-site audit repository as
historical evidence. It is not a continuing deployment prerequisite.
