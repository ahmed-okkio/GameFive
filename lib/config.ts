export const appConfig = {
  region: process.env.NEXT_PUBLIC_REGION ?? "EUW",
  riotApiKey: process.env.RIOT_API_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  queueDriver: process.env.QUEUE_DRIVER ?? "database",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "",
  companionIngestToken: process.env.COMPANION_INGEST_TOKEN ?? "dev-local-token",
  companionDownloadUrl: "https://github.com/ahmed-okkio/GameFive/releases/latest/download/GameFive.Companion.exe",
  maintenanceMode: process.env.MAINTENANCE_MODE === "true",
  patchDate: new Date("2026-06-11T20:52:50Z") // Sync with commit 988d731
};

export function requireEnv(name: keyof typeof appConfig) {
  const value = appConfig[name];

  if (!value) {
    throw new Error(`Missing required environment value: ${name}`);
  }

  return value;
}
