# Build manifest 0001: Relaunch

- PRD: [0001-relaunch.md](0001-relaunch.md)
- Acceptance contract: [0001-relaunch-contract.md](0001-relaunch-contract.md)
- Deadline: live **Tue Dec 1 2026**.

## Ground rules for every worker

- Work on a branch **`relaunch`** cut from `main`. Never commit to `prototype/*` branches; read them with `git show prototype/visual-direction:<path>`.
- Consult the `ponytail` skill: smallest complete change, reuse what exists.
- Production DB is touched only by the deployed app and Prisma migrations the owner approves. Tests use a local or test database.
- Vocabulary from `GLOSSARY.md` (Entrant, Countdown, Companion, …).

## Milestone ladder

| # | Milestone | Contract IDs | Notes |
|---|---|---|---|
| M1 | Revival: revert the takedown, upgrade deps, remove the worker | R1.1–R1.4 | Revert list in PRD §1. Keep `StartupRegistration.Unregister`. |
| M2 | Entrants and ingest hardening | R2.1–R2.11 | One Prisma migration: `registeredAt`, `removedAt`, `companionVersion` on players; raw payload and stats JSON on matches/participants; heal/shield-on-teammates columns; drop the promo columns. Strip LP, placement and rank lookups from `lib/ingest/mayhem.ts`. |
| M3 | Companion API | R3.1–R3.5 | New routes under `app/api/companion/`. Player session cookie separate from the admin next-auth session. |
| M4 | Companion 5.0.0 | R4.1–R4.9 | Bring in icons from `prototype/visual-direction` commit `fd0046b`. `ServerBaseUrl` stays a constant; M6 confirms its value. |
| M5 | Countdown site | R5.1–R5.9 | Port from `prototype/visual-direction` at fd0046b (`app/prototype/home/VariantB.tsx`, `Backdrop.tsx`, `mock.ts` shape, `public/prototype/gamefive-logo.svg`). Only the Countdown and Companion pages are in scope. Remove the old pages. |
| M6 | Admin trim, deploy, release, end to end | R6.1–R6.5 | Needs the owner: see below. |

## Owner steps (M6)

1. ~~Vercel login and the project~~: done 2026-11-21. Project `game-five-kohl` owns `game-five-kohl.vercel.app`, is Git-connected (production branch `main`) and has every env var, including the pooler `DATABASE_URL`.
2. Don't push to `main` until `relaunch` is merged, because a push deploys `main`.
3. Supabase `GameFive` was ACTIVE_HEALTHY on 2026-11-21 (eu-west-1). If it pauses, restore it by hand.
4. Approve the production Prisma migration.
5. Publish the Companion 5.0.0 release as Latest.
6. Play one Mayhem game with 5.0.0 running (R6.5).
