import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// ElevenLabs text-to-speech proxy. The key stays server-side; the browser sends
// text (and optionally its own key/voice) and gets back audio/mpeg.
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "9BWtsMINqrJLrRacOk9x"; // "Aria"
const MODEL_ID = process.env.ELEVENLABS_MODEL || "eleven_turbo_v2_5";
const TIMEOUT_MS = Number(process.env.ELEVENLABS_TIMEOUT_MS ?? 30_000);

export async function GET(req: Request) {
  // Status probe for Settings — reports whether a server env key exists.
  const hasServerKey = Boolean(process.env.ELEVENLABS_API_KEY);
  // A header key lets Settings test a browser-stored key with no body.
  void req;
  return NextResponse.json({ hasServerKey });
}

export async function POST(req: Request) {
  const headerKey = req.headers.get("x-elevenlabs-key")?.trim();
  const key = headerKey || process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "No ElevenLabs API key. Add one in Settings, or set ELEVENLABS_API_KEY in the environment.",
      },
      { status: 503 },
    );
  }

  let text = "";
  let voiceId = DEFAULT_VOICE_ID;
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
    if (typeof body?.voiceId === "string" && body.voiceId.trim()) {
      voiceId = body.voiceId.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "Text is required." }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Text is too long." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        signal: controller.signal,
        body: JSON.stringify({ text, model_id: MODEL_ID }),
      },
    );

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      // Surface ElevenLabs' reason (bad key, quota) without echoing the key.
      return NextResponse.json(
        { error: `ElevenLabs error (${res.status}): ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "ElevenLabs timed out." : "Couldn't reach ElevenLabs." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
