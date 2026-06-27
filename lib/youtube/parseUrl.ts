const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export function extractPlaylistId(input: string): string | null {
  if (!input) return null;

  let url: URL;
  try {
    const normalized = input.startsWith("http") ? input : `https://${input}`;
    url = new URL(normalized);
  } catch {
    return null;
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) return null;

  const listId = url.searchParams.get("list");
  return listId || null;
}
