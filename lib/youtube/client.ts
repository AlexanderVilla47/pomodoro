const BASE_URL = "https://www.googleapis.com/youtube/v3/playlistItems";
const PLAYLISTS_URL = "https://www.googleapis.com/youtube/v3/playlists";

export interface PlaylistInfo {
  title: string;
  thumbnailUrl: string | null;
}
const MAX_RESULTS = 50;

export interface Track {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  position: number;
}

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

type PlaylistItemsResponse = {
  items: Array<{
    snippet: {
      title: string;
      position: number;
      resourceId: { videoId: string };
      thumbnails?: { medium?: { url: string } };
    };
  }>;
  nextPageToken?: string;
};

export async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string
): Promise<Track[]> {
  const tracks: Track[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(BASE_URL);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", String(MAX_RESULTS));
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());

    if (!res.ok) {
      throw new YouTubeApiError(
        `YouTube API error: ${res.status}`,
        res.status
      );
    }

    const data = (await res.json()) as PlaylistItemsResponse;

    for (const item of data.items) {
      tracks.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? null,
        position: item.snippet.position,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return tracks;
}

export async function fetchPlaylistInfo(
  playlistId: string,
  apiKey: string
): Promise<PlaylistInfo> {
  const url = new URL(PLAYLISTS_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", playlistId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) throw new YouTubeApiError(`YouTube API error: ${res.status}`, res.status);

  const data = (await res.json()) as {
    items: Array<{ snippet: { title: string; thumbnails?: { medium?: { url: string } } } }>;
  };

  if (!data.items.length) throw new YouTubeApiError("Playlist not found", 404);

  const snippet = data.items[0].snippet;
  return {
    title: snippet.title,
    thumbnailUrl: snippet.thumbnails?.medium?.url ?? null,
  };
}
