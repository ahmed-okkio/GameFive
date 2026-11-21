-- CreateTable
CREATE TABLE "player_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "redirect" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "retire" BOOLEAN NOT NULL DEFAULT false,
    "ceremony_url" TEXT,
    "min_version" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_tokens_token_hash_key" ON "player_tokens"("token_hash");

-- AddForeignKey
ALTER TABLE "player_tokens" ADD CONSTRAINT "player_tokens_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

