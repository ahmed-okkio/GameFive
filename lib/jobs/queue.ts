import { Queue } from "bullmq";
import { requireEnv } from "@/lib/config";

export const PROFILE_QUEUE = "profile-calculations";
export const ENRICHMENT_QUEUE = "enrichment";

export function getQueueConnection() {
  const url = new URL(requireEnv("redisUrl"));

  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null
  };
}

export type ProfileJobData = {
  profileJobId: string;
  gameName: string;
  tagLine: string;
};

export function getProfileQueue() {
  return new Queue(PROFILE_QUEUE, {
    connection: getQueueConnection()
  });
}

export function getEnrichmentQueue() {
  return new Queue(ENRICHMENT_QUEUE, {
    connection: getQueueConnection()
  });
}
