import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { appConfig } from "@/lib/config";

export const authOptions: NextAuthOptions = {
  secret: appConfig.nextAuthSecret,
  session: {
    strategy: "jwt"
  },
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const password = credentials?.password ?? "";

        // Simple string comparison for development
        if (!appConfig.adminPasswordHash || password !== appConfig.adminPasswordHash) {
          return null;
        }

        return {
          id: "admin",
          name: "Admin"
        };
      }
    })
  ],
  pages: {
    signIn: "/admin"
  }
};
