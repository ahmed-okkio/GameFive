-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "puuid" TEXT,
    "riot_id_name" TEXT NOT NULL,
    "riot_id_tag" TEXT NOT NULL,
    "summoner_id" TEXT,
    "profile_icon_id" INTEGER,
    "summoner_level" INTEGER,
    "region" TEXT NOT NULL DEFAULT 'EUW',
    "solo_duo_tier" TEXT,
    "solo_duo_division" TEXT,
    "flex_tier" TEXT,
    "flex_division" TEXT,
    "raw_mmr" INTEGER NOT NULL DEFAULT 0,
    "baseline_mmr" DOUBLE PRECISION,
    "current_lp" INTEGER NOT NULL DEFAULT 0,
    "is_placed" BOOLEAN NOT NULL DEFAULT false,
    "promo_from_tier" TEXT,
    "promo_to_tier" TEXT,
    "promo_wins" INTEGER NOT NULL DEFAULT 0,
    "promo_losses" INTEGER NOT NULL DEFAULT 0,
    "historical_tier" TEXT,
    "historical_division" TEXT,
    "enrichment_depth" INTEGER NOT NULL DEFAULT 0,
    "mayhem_games" INTEGER NOT NULL DEFAULT 0,
    "aram_games" INTEGER NOT NULL DEFAULT 0,
    "last_game_date" TIMESTAMP(3),
    "last_game_tier" TEXT,
    "cache_updated_at" TIMESTAMP(3),
    "manual_refresh_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "game_mode" TEXT NOT NULL,
    "game_date" TIMESTAMP(3) NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "queue_id" INTEGER NOT NULL,
    "lobby_avg_mmr" DOUBLE PRECISION,
    "team_100_avg_mmr" INTEGER,
    "team_200_avg_mmr" INTEGER,
    "teams_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "player_id" TEXT,
    "player_riot_id_name" TEXT,
    "player_riot_id_tag" TEXT,
    "rank_signal_mmr" DOUBLE PRECISION,
    "rank_tier" TEXT,
    "league_points" INTEGER,
    "team" INTEGER NOT NULL,
    "win" BOOLEAN NOT NULL,
    "champion_id" INTEGER NOT NULL,
    "champion_name" TEXT,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "damage_to_champions" INTEGER NOT NULL,
    "healing_done" INTEGER NOT NULL,
    "kill_participation" DOUBLE PRECISION NOT NULL,
    "damage_share" DOUBLE PRECISION NOT NULL,
    "healing_share" DOUBLE PRECISION NOT NULL,
    "performance_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_time_crowd_control_dealt" INTEGER NOT NULL DEFAULT 0,
    "total_damage_shielded_on_teammates" INTEGER NOT NULL DEFAULT 0,
    "total_heal_on_teammates" INTEGER NOT NULL DEFAULT 0,
    "lp_delta" INTEGER NOT NULL DEFAULT 0,
    "is_placement" BOOLEAN NOT NULL DEFAULT false,
    "items_json" JSONB,
    "augments_json" JSONB,
    "spell1_id" INTEGER,
    "spell2_id" INTEGER,
    "champ_level" INTEGER,
    "gold_earned" INTEGER,
    "gold_spent" INTEGER,
    "damage_taken" INTEGER,
    "self_mitigated" INTEGER,
    "minions_killed" INTEGER,
    "double_kills" INTEGER,
    "triple_kills" INTEGER,
    "quadra_kills" INTEGER,
    "penta_kills" INTEGER,
    "total_units_healed" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_blacklist" (
    "id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "added_by" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "display_order" INTEGER,

    CONSTRAINT "leaderboard_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "players_riot_id_name_riot_id_tag_key" ON "players"("riot_id_name", "riot_id_tag");

-- CreateIndex
CREATE UNIQUE INDEX "matches_match_id_key" ON "matches"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_blacklist_player_id_key" ON "leaderboard_blacklist"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_blacklist" ADD CONSTRAINT "leaderboard_blacklist_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

