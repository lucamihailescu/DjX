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

// --- Local quota estimate ---------------------------------------------------
// The YouTube Data API exposes no endpoint to read quota usage, so we estimate
// it ourselves from each call's published unit cost. Our /api/youtube route
// spends one search.list (100) + one videos.list (1) per query = 101 units.
// The free daily quota is 10,000 units and resets at midnight Pacific.
export const QUOTA_DAILY_LIMIT = 10000;
export const SEARCH_COST = 101;

const QUOTA_KEY = "djx.youtube.quota";

export interface QuotaUsage {
  used: number;
  date: string; // Pacific-time day, YYYY-MM-DD, to match Google's reset
  limit: number;
}

/** Today's date in Pacific time (where Google's quota day resets). */
function pacificDay(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date());
}

/** Estimated units spent so far today (0 once the Pacific day rolls over). */
export function getQuotaUsage(): QuotaUsage {
  const date = pacificDay();
  try {
    const raw = window.localStorage.getItem(QUOTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { date?: string; used?: number };
      if (parsed?.date === date && typeof parsed.used === "number") {
        return { used: parsed.used, date, limit: QUOTA_DAILY_LIMIT };
      }
    }
  } catch {
    /* ignore */
  }
  return { used: 0, date, limit: QUOTA_DAILY_LIMIT };
}

function recordQuota(units: number): void {
  try {
    const { used, date } = getQuotaUsage();
    window.localStorage.setItem(
      QUOTA_KEY,
      JSON.stringify({ date, used: used + units }),
    );
  } catch {
    /* ignore */
  }
}

export async function searchYouTube(q: string): Promise<YouTubeResult[]> {
  const res = await fetch(`/api/youtube?q=${encodeURIComponent(q)}`, {
    headers: keyHeader(),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "YouTube search failed.");
  recordQuota(SEARCH_COST);
  return data.items ?? [];
}

/**
 * Resolve a list of AI-generated search queries to real, deduped YouTube
 * videos. Each query names one specific song, so we take the top hit per query.
 * Queries are capped because each search.list call costs 100 quota units.
 */
export async function resolveYouTube(
  queries: string[],
  limit = 20,
): Promise<YouTubeResult[]> {
  const capped = queries.slice(0, 12);
  const settled = await Promise.allSettled(capped.map((q) => searchYouTube(q)));

  const byId = new Map<string, YouTubeResult>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const top = r.value[0];
    if (top && !byId.has(top.videoId)) byId.set(top.videoId, top);
  }
  return [...byId.values()].slice(0, limit);
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
    recordQuota(SEARCH_COST);
    return null;
  } catch {
    return "Couldn't reach the YouTube API.";
  }
}
