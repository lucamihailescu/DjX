import { NextResponse } from "next/server";
import { auth, isEntraEnabled } from "@/auth";

// Server-side guard for API routes. The proxy's cookie-presence check is only
// an optimistic pre-filter (any cookie VALUE passes it), so routes that spend
// paid quota (ElevenLabs, YouTube, AI Gateway) must validate the session
// themselves. Like the proxy, the session check is opt-in: with Entra
// unconfigured the app runs ungated and only the rate limit applies.

const WINDOW_MS = 60_000;
const MAX_TRACKED_IPS = 1_000;
const hits = new Map<string, number[]>();

function rateLimited(req: Request, limit: number): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Per-route buckets so e.g. a burst of YouTube searches can't exhaust the
  // DJ-intro budget for the same user.
  const key = `${ip}:${new URL(req.url).pathname}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  // Backstop against unbounded growth from spoofed forwarded-for headers.
  if (!hits.has(key) && hits.size >= MAX_TRACKED_IPS) hits.clear();
  hits.set(key, recent);
  return false;
}

/**
 * Returns an error response the route should send back, or null when the
 * request may proceed. `limit` is requests per minute per IP.
 */
export async function requireApiAuth(
  req: Request,
  limit = 60,
): Promise<NextResponse | null> {
  if (rateLimited(req, limit)) {
    return NextResponse.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 },
    );
  }
  if (!isEntraEnabled) return null;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
