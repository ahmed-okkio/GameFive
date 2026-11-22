# Acceptance contract 0001: Relaunch

PRD: [0001-relaunch.md](0001-relaunch.md). Each ID is judged PASS / FAIL / BLOCKED with one line of evidence. IDs marked **(security)** block their milestone on FAIL.

## M1 Revival

- **R1.1** `app/page.tsx` and `app/layout.tsx` no longer contain the "Cessation of Operations" page; `middleware.ts` is gone; `companion/Program.cs` has no `SelfDestruct`, and `StartupRegistration.Unregister` still exists.
- **R1.2** `npm run typecheck`, `npm run build` and `npm test` pass.
- **R1.3** `npm audit --omit=dev` reports 0 critical and 0 high.
- **R1.4** No `worker` script in `package.json`; no `QUEUE_DRIVER`, `REDIS_URL`, `queueDriver` or `redisUrl` anywhere in the repo outside git history.

## M2 Entrants and ingest

- **R2.1** `register` for a new PUUID creates a player with `registeredAt` set; calling it again with a new Riot ID updates the name and keeps `registeredAt`; an old restored player who registers keeps their row (same id).
- **R2.2** **(security)** No code path looks a player up by Riot name for identity, and none overwrites a stored PUUID (grep plus a test: an upload whose participant has a known Riot name but a new PUUID does not attach to the old player).
- **R2.3** Ingest accepts a queue 2400 `MATCHED_GAME` payload; it rejects queue 3270 `CUSTOM_GAME` and queue 2400 with any other gameType as `not_mayhem`; it skips games under 240 s as `remake`.
- **R2.4** A payload with 9 items, 8 augments, unknown augment/item ids and extra unknown fields is accepted; one missing a participant `puuid` or `win` is rejected with 400.
- **R2.5** The stored match holds the raw payload and the uploader's end-of-game `stats` JSON; heal-on-teammates and shield-on-teammates columns are filled from it.
- **R2.6** An upload whose uploader is not an Entrant (no `registeredAt`, or removed) is not stored and answers `not_entrant`; no player row is created.
- **R2.7** Two concurrent uploads of the same game: exactly one match row; one answer `stored`, the other `duplicate`; no 500.
- **R2.8** If writing participants fails, no match row remains (transaction), and the response is 500.
- **R2.9** Ingest makes no outbound HTTP calls (test with network calls stubbed to throw); `resolveRank`, `fetchOpggHistoricalRank` and team/lobby MMR averaging are gone.
- **R2.10** Ingest writes no `lpDelta`, `rawMmr`, `currentLp` or placement change; `lib/mmr/calculate-profile.ts`, `lib/mmr/promos.ts` and the promo columns are gone; nothing inserts into `leaderboard_blacklist`.
- **R2.11** For an Entrant registered at time T, a stored game that ended before T is excluded by the shared "counts for Entrant" query helper, and one that ended after T is included.

## M3 Companion API

- **R3.1** **(security)** Every `/api/companion/*` endpoint except `status`, and `/api/ingest/match`, rejects a missing or wrong token with 401.
- **R3.2** `login-link` returns a URL. Opening it once sets a session cookie (and server session) lasting until the later of 30 days and 2027-01-02T00:00:00Z, and redirects; opening it again, or after 5 minutes, fails. The token is not stored in plain text. **(security)**
- **R3.3** `inbox` answers `{items: [], now}` during the Countdown, accepts `since` and `briefing`, and its item shape is `{id, title, body, url}` (type exported for the Event spec).
- **R3.4** `status` answers `{retire, ceremonyUrl, minVersion}` without a token; `retire` follows the admin flag.
- **R3.5** Each Companion request's `X-Companion-Version` is stored on the player as their latest version.

## M4 Companion 5.0.0

- **R4.1** The project targets .NET 10 and publishes one self-contained single-file exe; assembly version 5.0.0.
- **R4.2** Run from Downloads, it copies itself to `%LocalAppData%\GameFive\`, registers autostart to that copy and relaunches from it (unit-test the path logic; manual check on the owner's PC).
- **R4.3** The live path and the tray backfill both upload only queue 2400 `MATCHED_GAME` (shared predicate, unit-tested with 2400/MATCHED_GAME, 2400/CUSTOM_GAME, 3270/CUSTOM_GAME).
- **R4.4** The upload carries the 10-player match-history game and the end-of-game `stats` block with `totalHealOnTeammates` and `totalDamageShieldedOnTeammates`; every request sends `X-Companion-Version: 5.0.0`.
- **R4.5** `register` is called on every League client connect. After the first successful `register` for a PUUID on an install, the Companion opens a login link to the home page once; later connects, restarts and a reinstall over the same AppData don't open it again; another PUUID on the same install gets its own once.
- **R4.6** Retirement: with `retire: true` it drains the queue, unregisters autostart, shows one toast with `ceremonyUrl` and deletes its exe and AppData; with the endpoint unreachable it does nothing. Checked at startup and every 6 h.
- **R4.7** Updates follow `releases/latest`, never apply during ChampSelect or InProgress, and run immediately when `minVersion` is above the running version.
- **R4.8** Inbox polling every 60 s and after each upload, only while the client is connected; one balloon per poll; a click opens the item URL via a fresh login link; `briefing=1` on the first connect of each GMT day.
- **R4.9** The tray menu is exactly: status line, Open Mayhem Week, Upload recent games, Check for updates, Open log, Exit. The tray uses the crest icons.

## M5 Countdown site

- **R5.1** Before Dec 25 00:00 GMT, `/` renders the Countdown matching the prototype (`prototype/visual-direction` at fd0046b, `?variant=B3&mode=countdown`) in layout, copy, spacing and motion. Validator compares Playwright screenshots at 1440×900 and 390×844 side by side; differences other than real data (clock, names) FAIL.
- **R5.2** The clock counts down to 2026-12-25T00:00:00Z (test with a fixed clock) and gives screen readers one sentence, not a ticking region.
- **R5.3** The Entrant list shows every current Entrant (name and tag), newest first, with the count; removed Entrants and old non-registered players are absent.
- **R5.4** **Download the Companion** links to `releases/latest/download/GameFive.Companion.exe`.
- **R5.5** There is no `/companion` page (it redirects to `/`, and nothing links to it). On `/`, a logged-in Entrant sees "You're entered to play in GameFive: One Last Chance." and their own Entrant row marked (gold, "You") and scrolled into view in the list, and no "You're not in yet" text (download button and steps remain); a logged-out visitor sees neither line nor mark, and does see "You're not in yet". No quiet/"hasn't sent a game" warning anywhere.
- **R5.6** `/leaderboard`, `/player/x/y` and the old search redirect to `/`; the `players/.../status` and `refresh` APIs are gone.
- **R5.7** The splash plays on a full load, not on client navigation, and not under `prefers-reduced-motion`.
- **R5.8** The tab icon and header logo are the crest.
- **R5.9** No restored-history player who hasn't registered appears anywhere on the site.

## M6 Admin, release and go-live

- **R6.1** Admin can remove an Entrant, delete a match, flip the retirement flag and toggle the maintenance pause (while on, ingest answers 503 and stores nothing, and the site shows a one-line notice; off again, ingest resumes); non-admins get 401/redirect. **(security)**
- **R6.2** The Vercel project serves the site at the relaunch URL (`https://game-five-kohl.vercel.app` unless the owner records otherwise) using the pooler `DATABASE_URL`.
- **R6.3** `ServerBaseUrl` in the Companion equals the live URL.
- **R6.4** GitHub `releases/latest` resolves to 5.0.0, and its asset is `GameFive.Companion.exe`.
- **R6.5** End to end: on the owner's PC, a downloaded 5.0.0 installs itself, registers (the owner appears on the Entrant list), and one real Mayhem game appears as a stored match with end-of-game stats.
