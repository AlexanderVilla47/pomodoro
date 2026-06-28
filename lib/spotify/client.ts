import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl: string | null;
  totalTracks: number;
}

export interface SpotifyTrack {
  uri: string;
  id: string;
  name: string;
  artistName: string;
  durationMs: number;
  imageUrl: string | null;
}

const ACCOUNTS_URL = "https://accounts.spotify.com";
const API_URL = "https://api.spotify.com/v1";

function clientId() {
  return process.env.SPOTIFY_CLIENT_ID!;
}
function clientSecret() {
  return process.env.SPOTIFY_CLIENT_SECRET!;
}

export function getAuthUrl(redirectUri: string, state: string): string {
  const scopes = [
    "streaming",
    "user-read-email",
    "user-read-private",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-modify-playback-state",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes,
    state,
  });

  return `${ACCOUNTS_URL}/authorize?${params}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
  const res = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Spotify token exchange failed: ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(`${ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId()}:${clientSecret()}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Spotify token refresh failed");

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function saveTokens(
  sql: Sql,
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  await sql`
    INSERT INTO spotify_tokens (user_id, access_token, refresh_token, expires_at)
    VALUES (${userId}, ${accessToken}, ${refreshToken}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE SET
      access_token = EXCLUDED.access_token,
      refresh_token = EXCLUDED.refresh_token,
      expires_at = EXCLUDED.expires_at
  `;
}

export async function deleteTokens(sql: Sql, userId: string): Promise<void> {
  await sql`DELETE FROM spotify_tokens WHERE user_id = ${userId}`;
}

export async function getAccessToken(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<
    { access_token: string; refresh_token: string; expires_at: Date }[]
  >`SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE user_id = ${userId}`;

  if (!rows.length) return null;

  const { access_token, refresh_token, expires_at } = rows[0];

  // Refresh if expires within 60 seconds
  if (new Date(expires_at).getTime() - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(refresh_token);
    await sql`
      UPDATE spotify_tokens SET access_token = ${refreshed.accessToken}, expires_at = ${refreshed.expiresAt}
      WHERE user_id = ${userId}
    `;
    return refreshed.accessToken;
  }

  return access_token;
}

export async function getPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const res = await fetch(`${API_URL}/me/playlists?limit=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Spotify playlists");
  const data = await res.json();
  return data.items.map((p: Record<string, unknown>) => ({
    id: p.id as string,
    name: p.name as string,
    imageUrl: ((p.images as { url: string }[])?.[0]?.url) ?? null,
    totalTracks: (p.tracks as { total: number }).total,
  }));
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let url: string | null = `${API_URL}/playlists/${playlistId}/tracks?limit=100&fields=next,items(track(id,uri,name,duration_ms,artists,album(images)))`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const item of data.items) {
      const t = item.track;
      if (!t || !t.uri) continue;
      tracks.push({
        uri: t.uri,
        id: t.id,
        name: t.name,
        artistName: t.artists?.[0]?.name ?? "",
        durationMs: t.duration_ms,
        imageUrl: t.album?.images?.[0]?.url ?? null,
      });
    }
    url = data.next ?? null;
  }

  return tracks;
}
