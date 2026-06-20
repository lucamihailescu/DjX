import { NextResponse } from "next/server";
import { readKV, writeKV } from "@/lib/db";

export const runtime = "nodejs";

const NAMESPACE = "youtube_history";
const MAX_ITEMS = 50;

// Derive the user id from the Spotify token so a client can't read/write
// another account's data by spoofing an id.
async function userIdFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const r = await fetch("https://api.spotify.com/v1/me", {
      headers: { authorization: auth },
    });
    if (!r.ok) return null;
    const me = await r.json();
    return typeof me?.id === "string" ? me.id : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ items: [] });
  const items = readKV<unknown[]>(userId, NAMESPACE) ?? [];
  return NextResponse.json({ items });
}

export async function PUT(req: Request) {
  const userId = await userIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
  writeKV(userId, NAMESPACE, items);
  return NextResponse.json({ ok: true });
}
