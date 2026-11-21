import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { NextAuthOptions } from "next-auth";
import { appConfig } from "@/lib/config";

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const safeEqual = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));

// ADMIN_PASSWORD_HASH may hold a bcrypt hash ($2a$/$2b$/$2y$) or, for now, a plaintext password.
export async function checkAdminCredentials(username: string, password: string) {
  const stored = appConfig.adminPasswordHash;
  if (!stored || !password) return false;
  const userOk = safeEqual(username, appConfig.adminUsername);
  const passOk = /^\$2[aby]\$/.test(stored) ? await bcrypt.compare(password, stored) : safeEqual(password, stored);
  return userOk && passOk;
}

// The only next-auth provider is the admin login, so any session is the admin.
export async function isAdmin() {
  return !!(await getServerSession(authOptions));
}

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
        if (!(await checkAdminCredentials(credentials?.username ?? "", credentials?.password ?? ""))) {
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
