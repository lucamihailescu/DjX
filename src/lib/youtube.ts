import { getYouTubeKey } from "@/lib/settings";

export interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

function keyHeader(explicitKey?: string): HeadersInit {
  const key = explicitKey ?? getYouTubeKey();
  return key ? { "x-youtube-key": key } : {};
}

export async function searchYouTube(q: string): Promise<YouTubeResult[]> {
  const res = await fetch(`/api/youtube?q=${encodeURIComponent(q)}`, {
    headers: keyHeader(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "YouTube search failed.");
  return data.items ?? [];
}

/** Whether the server has a YOUTUBE_API_KEY env configured (no quota cost). */
export async function youTubeServerHasKey(): Promise<boolean> {
  try {
    const res = await fetch("/api/youtube");
    const data = await res.json().catch(() => null);
    return Boolean(data?.hasServerKey);
  } catch {
    return false;
  }
}

/** Validate a key with a tiny real search. Returns null on success, else error. */
export async function testYouTubeKey(key?: string): Promise<string | null> {
  try {
    const res = await fetch("/api/youtube?q=test", { headers: keyHeader(key) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return data?.error ?? "YouTube request failed.";
    return null;
  } catch {
    return "Couldn't reach the YouTube API.";
  }
}
