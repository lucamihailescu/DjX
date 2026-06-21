import { NextResponse } from "next/server";
import { chatJSON, extractJSON } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a music curator building a playlist from the USER'S OWN library.
You are given a numbered list of candidate tracks (their saved / top / recent music) and a mood or request.
Select the tracks that best fit, and ORDER them for good listening flow (ease in, build, then wind down as fitting).
Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "name": string,        // a punchy playlist name, max 80 chars
  "description": string, // one short sentence describing the vibe
  "indices": number[]    // the chosen candidate numbers, in playback order
}
Rules:
- "indices" must reference ONLY numbers that appear in the candidate list. Never invent tracks.
- Choose 15-30 tracks (fewer if the library is small). Prefer quality of fit over quantity.
- Do not repeat an index. Order matters — arrange for a pleasing arc.
Return the JSON object and nothing else.`;

interface Candidate {
  i: number;
  label: string;
}

interface Curation {
  name: string;
  description: string;
  indices: number[];
}

function coerce(raw: unknown, max: number, fallbackName: string): Curation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seen = new Set<number>();
  const indices = Array.isArray(o.indices)
    ? o.indices
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 0 && n < max && !seen.has(n) && (seen.add(n), true))
        .slice(0, 40)
    : [];
  if (indices.length === 0) return null;
  return {
    name:
      typeof o.name === "string" && o.name.trim()
        ? o.name.trim().slice(0, 80)
        : fallbackName,
    description:
      typeof o.description === "string" ? o.description.trim().slice(0, 200) : "",
    indices,
  };
}

export async function POST(req: Request) {
  let prompt = "";
  let candidates: Candidate[] = [];
  let reqBaseUrl: unknown;
  let reqModel: unknown;
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    candidates = Array.isArray(body?.tracks)
      ? body.tracks
          .filter(
            (t: unknown): t is Candidate =>
              !!t &&
              typeof (t as Candidate).i === "number" &&
              typeof (t as Candidate).label === "string",
          )
          .slice(0, 160)
      : [];
    reqBaseUrl = body?.baseUrl;
    reqModel = body?.model;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
  }
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "Your library looks empty — nothing to curate from." },
      { status: 400 },
    );
  }

  const list = candidates.map((c) => `${c.i}. ${c.label}`).join("\n");
  const userContent = `Mood / request: "${prompt}"\n\nCandidate tracks:\n${list}`;

  const chat = await chatJSON({
    system: SYSTEM_PROMPT,
    user: userContent,
    temperature: 0.7,
    baseUrl: reqBaseUrl,
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

  const curation = coerce(parsed, candidates.length, prompt.slice(0, 80));
  if (!curation) {
    return NextResponse.json(
      { error: "The model didn't pick any tracks. Try rephrasing the mood." },
      { status: 502 },
    );
  }

  return NextResponse.json(curation);
}
