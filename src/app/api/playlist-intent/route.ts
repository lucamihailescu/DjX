import { NextResponse } from "next/server";
import { chatJSON, extractJSON } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a music curator that designs Spotify playlists.
Given a user's request, respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "name": string,        // a punchy playlist name, max 80 chars
  "description": string, // one short sentence describing the vibe
  "queries": string[]    // 6-10 Spotify search queries that will surface fitting tracks
}
Rules for "queries" — these run against the Spotify Search API, so ONLY use real Spotify search syntax:
- Allowed field filters: genre:, artist:, track:, album:, year: (e.g. genre:edm, artist:Skrillex, year:2015-2024).
- You MAY also use plain free-text terms (e.g. "big room house", "festival anthem").
- NEVER invent filters. Do NOT use bpm:, popularity:, energy:, mood:, filter:, or any operator not listed above — Spotify ignores them and returns nothing.
- One artist per query at most. Keep each query short (1-4 terms).
- Mix the styles: some genre/subgenre queries, some seed-artist queries, some mood/era free-text. Favor popular, well-known acts that fit the request.
Return the JSON object and nothing else.`;

const YT_SYSTEM_PROMPT = `You are a music curator that builds a YouTube music-video queue.
Given a user's request, respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "name": string,        // a punchy queue name, max 80 chars
  "description": string, // one short sentence describing the vibe
  "queries": string[]    // 8-12 YouTube search queries, each naming ONE specific song
}
Rules for "queries" — these run against YouTube search:
- Each query names a SPECIFIC, real song the way a person would type it, e.g. "Daft Punk - Around the World" or "Tame Impala The Less I Know The Better".
- Prefer the "Artist - Song Title" form. Pick well-known songs that fit the request.
- Do NOT use field filters like genre:, year:, or bpm: — YouTube ignores them.
- Spread the picks across the artists, era, and mood implied by the request.
Return the JSON object and nothing else.`;

interface Intent {
  name: string;
  description: string;
  queries: string[];
}

function coerceIntent(raw: unknown, fallbackName: string): Intent | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const queries = Array.isArray(o.queries)
    ? o.queries.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  if (queries.length === 0) return null;
  return {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 80) : fallbackName,
    description:
      typeof o.description === "string" ? o.description.trim().slice(0, 200) : "",
    queries: queries.slice(0, 12),
  };
}

export async function POST(req: Request) {
  let prompt = "";
  let refine = "";
  let current: string[] = [];
  let reqModel: unknown;
  let target: "spotify" | "youtube" = "spotify";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    refine = typeof body?.refine === "string" ? body.refine.trim().slice(0, 400) : "";
    current = Array.isArray(body?.current)
      ? body.current.filter((s: unknown): s is string => typeof s === "string").slice(0, 40)
      : [];
    reqModel = body?.model;
    target = body?.target === "youtube" ? "youtube" : "spotify";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // When refining, give the model the current tracklist + the change request.
  const userContent = refine
    ? `Original request: "${prompt}"\n\nCurrent playlist:\n${current
        .map((t) => `- ${t}`)
        .join("\n")}\n\nChange request: "${refine}"\n\nProduce an UPDATED set of search queries that applies the change request while staying true to the original vibe. Keep what works; adjust the rest.`
    : prompt;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }
  if (prompt.length > 400) {
    return NextResponse.json({ error: "Prompt is too long." }, { status: 400 });
  }

  const chat = await chatJSON({
    system: target === "youtube" ? YT_SYSTEM_PROMPT : SYSTEM_PROMPT,
    user: userContent,
    temperature: 0.8,
    model: reqModel,
  });
  if (!chat.ok || !chat.content) {
    return NextResponse.json(
      { error: chat.error ?? "The model failed to respond." },
      { status: chat.status ?? 502 },
    );
  }

  const parsed = extractJSON(chat.content);
  if (!parsed) {
    return NextResponse.json(
      { error: "The model did not return valid JSON." },
      { status: 502 },
    );
  }

  const intent = coerceIntent(parsed, prompt.slice(0, 80));
  if (!intent) {
    return NextResponse.json(
      { error: "The model response was missing search queries." },
      { status: 502 },
    );
  }

  return NextResponse.json(intent);
}
