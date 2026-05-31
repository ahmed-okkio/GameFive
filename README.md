# GameFive

Private unofficial ARAM Mayhem MMR tracker for a small EUW friend group.

## Setup

1. Install dependencies with `npm install`.
2. Use the checked-in local defaults in `.env.local` and `.env`, or replace them with your own values.
3. Run `npm run prisma:push`.
4. Start the app with `npm run dev`.
5. Start the worker in a second terminal with `npm run worker`.

## Notes

- ARAM Mayhem uses Riot queue ID `2400`.
- Regular ARAM uses Riot queue ID `450`.
- First-time profiles enqueue a depth 0 calculation and show an awaiting screen while the worker fetches Riot ranked/profile data and regular ARAM history.
- Mayhem data is not fetched from Riot Match-V5. It is expected to arrive from the companion app via local LCU capture.
- `npm run worker` resumes queued or interrupted local database jobs.
- `.env.local` and `.env` are ignored and contain local secrets only.
- Local dev uses SQLite at `prisma/dev.db` and a database-backed queue, so Postgres and Redis are not required.
- SQLite can also work for production if the app and worker run on one persistent server or volume-backed host.
- Hosted Postgres and BullMQ/Redis remain the better production path for stateless/serverless hosting or heavier concurrency.
- Production can switch back to hosted Postgres and BullMQ/Redis by changing the Prisma datasource provider, setting `DATABASE_URL`, setting `REDIS_URL`, and using `QUEUE_DRIVER=bullmq`.
- The generated local admin login is username `admin`, password `admin`; change it before sharing the app.

## V1 Companion Flow

- The website uses Riot only for Riot ID resolution, summoner profile, ranked entries, and regular ARAM history.
- Uploaded companion Mayhem matches are read from the database during profile recalculation.
- V1 enrichment estimates unknown Mayhem opponents from ranked Solo/Flex only.
- Later enrichment work should add opponent ARAM history, real depth processing, and lobby MMR recalculation from enriched opponent MMR.
