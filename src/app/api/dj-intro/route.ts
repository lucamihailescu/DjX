import { NextResponse } from "next/server";
import { chatJSON, extractJSON } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are an energetic but tasteful radio DJ introducing the next song.
Given the upcoming track (and optionally the one that just played), write ONE short spoken intro line.
Respond with ONLY a JSON object: {"line": string}
Rules for "line":
- Max 30 words, one or two sentences, spoken aloud — no emojis, no hashtags, no stage directions or asterisks.
- Sound natural on air: hype the next track, maybe nod to the last one. Vary your phrasing.
- Do NOT include the JSON keys or quotes in the spoken words.
Return the JSON object and nothing else.`;

function coerceLine(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as Record<string, unknown>;
  return typeof o.line === "string" ? o.line.trim().slice(0, 300) : "";
}

export async function POST(req: Request) {
  let track = "";
  let prev = "";
  let reqModel: unknown;
  try {
    const body = await req.json();
    track = typeof body?.track === "string" ? body.track.trim().slice(0, 200) : "";
    prev = typeof body?.prev === "string" ? body.prev.trim().slice(0, 200) : "";
    reqModel = body?.model;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!track) {
    return NextResponse.json({ error: "Track is required." }, { status: 400 });
  }

  const userContent = prev
    ? `That was: "${prev}". Next up: "${track}".`
    : `Next up: "${track}".`;

  const chat = await chatJSON({
    system: SYSTEM_PROMPT,
    user: userContent,
    temperature: 0.9,
    model: reqModel,
  });
  if (!chat.ok || !chat.content) {
    return NextResponse.json(
      { error: chat.error ?? "The model failed to respond." },
      { status: chat.status ?? 502 },
    );
  }

  const line = coerceLine(extractJSON(chat.content));
  if (!line) {
    return NextResponse.json(
      { error: "The model did not return a usable line." },
      { status: 502 },
    );
  }
  return NextResponse.json({ line });
}
