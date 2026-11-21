-- DropIndex
DROP INDEX "players_riot_id_name_riot_id_tag_key";

-- AlterTable
ALTER TABLE "players" DROP COLUMN "promo_from_tier",
DROP COLUMN "promo_losses",
DROP COLUMN "promo_to_tier",
DROP COLUMN "promo_wins",
ADD COLUMN     "companion_version" TEXT,
ADD COLUMN     "registered_at" TIMESTAMP(3),
ADD COLUMN     "removed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "game_ended_at" TIMESTAMP(3),
ADD COLUMN     "raw_payload" JSONB;

-- AlterTable
ALTER TABLE "match_participants" ADD COLUMN     "end_of_game_stats" JSONB;

-- CreateIndex
CREATE INDEX "players_puuid_idx" ON "players"("puuid");


-- Backfill so the "counts for Entrant" helper can compare end times on legacy rows.
UPDATE "matches" SET "game_ended_at" = "game_date" + "duration_seconds" * INTERVAL '1 second' WHERE "game_ended_at" IS NULL;
