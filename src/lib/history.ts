import type { YouTubeResult } from "./youtube";

/** Load server-persisted YouTube history. Returns null if unavailable. */
export async function loadHistory(
  token: string,
): Promise<YouTubeResult[] | null> {
  try {
    const r = await fetch("/api/history", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return Array.isArray(d?.items) ? (d.items as YouTubeResult[]) : [];
  } catch {
    return null;
  }
}

/** Persist YouTube history server-side (best effort). */
export async function saveHistory(token: string, items: YouTubeResult[]) {
  try {
    await fetch("/api/history", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    });
  } catch {
    /* offline — localStorage still holds the copy */
  }
}
