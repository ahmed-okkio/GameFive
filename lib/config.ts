export const appConfig = {
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH ?? "",
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "",
  // Fails closed in production: no token configured means every Companion request is rejected.
  companionIngestToken: process.env.COMPANION_INGEST_TOKEN ?? (process.env.NODE_ENV === "production" ? "" : "dev-local-token"),
  companionDownloadUrl: "https://github.com/ahmed-okkio/GameFive/releases/latest/download/GameFive.Companion.exe"
};
