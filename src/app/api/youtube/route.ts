import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

const youtube = google.youtube("v3");

export interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
}

export async function GET(req: Request) {
  // A key set in Settings (this browser) takes precedence over the env key.
  const headerKey = req.headers.get("x-youtube-key")?.trim();
  const hasServerKey = Boolean(process.env.YOUTUBE_API_KEY);
  const key = headerKey || process.env.YOUTUBE_API_KEY;

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) {
    // Status probe used by the Settings page (no quota cost).
    return NextResponse.json({ items: [], hasServerKey });
  }

  if (!key) {
    return NextResponse.json(
      {
        error:
          "No YouTube API key. Add one in Settings, or set YOUTUBE_API_KEY in .env.local (enable 'YouTube Data API v3' in Google Cloud Console).",
      },
      { status: 503 },
    );
  }

  try {
    const res = await youtube.search.list({
      key,
      part: ["id"],
      q,
      type: ["video"],
      maxResults: 18,
      // Soft hint only — search.list's videoEmbeddable filter is unreliable and
      // still returns videos that block embedding, so we verify below.
      videoEmbeddable: "true",
      // Music category bias; falls back gracefully if a region lacks it.
      videoCategoryId: "10",
    });

    const ids = (res.data.items ?? [])
      .map((it) => (typeof it.id?.videoId === "string" ? it.id.videoId : ""))
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Authoritative embeddability check. search.list's flag is a soft hint;
    // status.embeddable is the real signal, and age-restricted videos can
    // never be embedded regardless of that flag (they show "Video unavailable").
    const details = await youtube.videos.list({
      key,
      part: ["snippet", "status", "contentDetails"],
      id: ids,
    });

    const items: YouTubeResult[] = (details.data.items ?? [])
      .filter(
        (v) =>
          v.status?.embeddable === true &&
          v.contentDetails?.contentRating?.ytRating !== "ytAgeRestricted",
      )
      .map((v) => {
        const s = v.snippet;
        const thumb =
          s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? "";
        return {
          videoId: v.id ?? "",
          title: s?.title ?? "",
          channel: s?.channelTitle ?? "",
          thumbnail: thumb,
        };
      })
      .filter((r) => r.videoId);

    return NextResponse.json({ items });
  } catch (e: unknown) {
    // Surface YouTube's reason (quota, bad key, etc.) without leaking the key.
    const err = e as { message?: string; code?: number };
    const quota = /quota/i.test(err?.message ?? "");
    return NextResponse.json(
      {
        error: quota
          ? "YouTube API quota exceeded for today."
          : `YouTube search failed${err?.message ? `: ${err.message}` : "."}`,
      },
      { status: 502 },
    );
  }
}
