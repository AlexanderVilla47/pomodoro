import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAuthUrl } from "@/lib/spotify/client";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const hdrs = await headers();
  const origin = hdrs.get("origin") ?? new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/spotify/callback`;

  const state = crypto.randomUUID();
  const url = getAuthUrl(redirectUri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
