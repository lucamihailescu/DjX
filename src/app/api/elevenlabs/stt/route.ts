import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// ElevenLabs speech-to-text (Scribe) proxy. The browser posts recorded audio as
// multipart form-data (`file`); the key stays server-side. Returns { text }.
const MODEL_ID = process.env.ELEVENLABS_STT_MODEL || "scribe_v1";
const TIMEOUT_MS = Number(process.env.ELEVENLABS_TIMEOUT_MS ?? 30_000);

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

  let file: Blob | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof Blob) file = f;
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }
  // Guard against oversized uploads (~10 MB of recorded audio is plenty).
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Audio is too long." }, { status: 413 });
  }

  const out = new FormData();
  out.append("file", file, "audio.webm");
  out.append("model_id", MODEL_ID);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: out,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `ElevenLabs error (${res.status}): ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = await res.json().catch(() => null);
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    return NextResponse.json({ text });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Transcription timed out." : "Couldn't reach ElevenLabs." },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
