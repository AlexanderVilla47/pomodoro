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

// Error que preserva el status HTTP y el cuerpo de la respuesta de Spotify, así
// las rutas pueden decidir (ej: reintentar en 401) y exponer el status real para
// diagnosticar en vez de tragarse el error.
export class SpotifyApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Spotify API ${status}`);
    this.name = "SpotifyApiError";
  }
}

export class SpotifyNotConnectedError extends Error {
  constructor() {
    super("Spotify not connected");
    this.name = "SpotifyNotConnectedError";
  }
}

async function spotifyFetch(accessToken: string, url: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SpotifyApiError(res.status, body);
  }
  return res;
}

// Ejecuta una llamada a la Web API con manejo de token: si Spotify responde 401
// (token vencido/inválido pese a lo que dice expires_at), fuerza un refresh y
// reintenta UNA vez. Lanza SpotifyNotConnectedError si no hay cuenta conectada.
export async function callSpotify<T>(
  sql: Sql,
  userId: string,
  fn: (accessToken: string) => Promise<T>
): Promise<T> {
  const token = await getAccessToken(sql, userId);
  if (!token) throw new SpotifyNotConnectedError();
  try {
    return await fn(token);
  } catch (e) {
    if (e instanceof SpotifyApiError && e.status === 401) {
      const fresh = await getAccessToken(sql, userId, true);
      if (fresh) return await fn(fresh);
    }
    throw e;
  }
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
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> {
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

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SpotifyApiError(res.status, body);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    // Spotify a veces rota el refresh_token; si viene uno nuevo hay que guardarlo,
    // si no seguimos con el que teníamos.
    refreshToken: data.refresh_token ?? refreshToken,
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

export async function getAccessToken(
  sql: Sql,
  userId: string,
  forceRefresh = false
): Promise<string | null> {
  const rows = await sql<
    { access_token: string; refresh_token: string; expires_at: Date }[]
  >`SELECT access_token, refresh_token, expires_at FROM spotify_tokens WHERE user_id = ${userId}`;

  if (!rows.length) return null;

  const { access_token, refresh_token, expires_at } = rows[0];

  // Refresca si se fuerza (ej: tras un 401) o si vence dentro de 60 segundos.
  if (forceRefresh || new Date(expires_at).getTime() - Date.now() < 60_000) {
    const refreshed = await refreshAccessToken(refresh_token);
    await sql`
      UPDATE spotify_tokens
      SET access_token = ${refreshed.accessToken},
          refresh_token = ${refreshed.refreshToken},
          expires_at = ${refreshed.expiresAt}
      WHERE user_id = ${userId}
    `;
    return refreshed.accessToken;
  }

  return access_token;
}

export async function getPlaylists(accessToken: string): Promise<SpotifyPlaylist[]> {
  const res = await spotifyFetch(accessToken, `${API_URL}/me/playlists?limit=50`);
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
    const res: Response = await spotifyFetch(accessToken, url);
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

// Parsea el `context.uri` que devuelve el reproductor (ej: "spotify:album:X").
// Solo soportamos playlist y álbum, que son contextos con una lista ordenada
// que podemos expandir. artist/collection/radio no tienen una lista fija.
export function parseContextUri(
  uri: string
): { type: "playlist" | "album"; id: string } | null {
  const match = /^spotify:(playlist|album):([A-Za-z0-9]+)$/.exec(uri);
  if (!match) return null;
  return { type: match[1] as "playlist" | "album", id: match[2] };
}

export async function getAlbumTracks(
  accessToken: string,
  albumId: string
): Promise<SpotifyTrack[]> {
  // El álbum trae la portada y la primera página de tracks. Los tracks del
  // endpoint de álbum vienen "simplificados" (sin imagen propia), así que le
  // aplicamos la portada del álbum a todos.
  const albumRes = await spotifyFetch(accessToken, `${API_URL}/albums/${albumId}`);
  const album = await albumRes.json();
  const cover: string | null = album.images?.[0]?.url ?? null;

  const tracks: SpotifyTrack[] = [];
  const pushItems = (items: Record<string, unknown>[]) => {
    for (const t of items) {
      if (!t || !t.uri) continue;
      tracks.push({
        uri: t.uri as string,
        id: t.id as string,
        name: t.name as string,
        artistName: ((t.artists as { name: string }[])?.[0]?.name) ?? "",
        durationMs: t.duration_ms as number,
        imageUrl: cover,
      });
    }
  };

  pushItems(album.tracks?.items ?? []);
  let next: string | null = album.tracks?.next ?? null;
  while (next) {
    const res: Response = await spotifyFetch(accessToken, next);
    const data = await res.json();
    pushItems(data.items ?? []);
    next = data.next ?? null;
  }

  return tracks;
}

// Expande el contexto actualmente en reproducción a su lista completa de tracks.
// Devuelve null si el contexto no es expandible (radio, artista, tema suelto),
// para que la UI caiga a su fallback.
export async function getContextTracks(
  accessToken: string,
  contextUri: string
): Promise<SpotifyTrack[] | null> {
  const ctx = parseContextUri(contextUri);
  if (!ctx) return null;
  if (ctx.type === "playlist") return getPlaylistTracks(accessToken, ctx.id);
  return getAlbumTracks(accessToken, ctx.id);
}
