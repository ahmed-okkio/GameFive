import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The old leaderboard and player profiles (where the Riot ID search led) are gone until the Event spec.
  redirects: async () => [
    { source: "/leaderboard", destination: "/", permanent: false },
    { source: "/player/:path*", destination: "/", permanent: false }
  ]
};

export default nextConfig;
