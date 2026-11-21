import { NextResponse } from "next/server";
import { consumeLoginToken, PLAYER_SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/companion";

// Opened in the browser from a login link; the single-use login token is the credential here.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const login = token ? await consumeLoginToken(token) : null;
  if (!login) return new NextResponse("This login link is invalid, used or expired. Open a new one from the Companion tray.", { status: 401 });

  const response = NextResponse.redirect(new URL(login.redirect, request.url), 303);
  response.cookies.set(PLAYER_SESSION_COOKIE, login.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000
  });
  return response;
}
