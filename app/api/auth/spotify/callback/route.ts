import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/index";
import { exchangeCode, saveTokens } from "@/lib/spotify/client";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("spotify_oauth_state")?.value;

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL("/?spotify_error=state_mismatch", req.url));
  }

  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/spotify/callback`;

  try {
    const tokens = await exchangeCode(code, redirectUri);
    const sql = getDb();
    await saveTokens(sql, session.user.id, tokens.accessToken, tokens.refreshToken, tokens.expiresAt);
  } catch {
    return NextResponse.redirect(new URL("/?spotify_error=exchange_failed", req.url));
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete("spotify_oauth_state");
  return res;
}
